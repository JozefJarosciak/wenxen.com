// === Regular XEN Stakes scanner (contract-only, ratelimited, FIXED decode) ====
// Fix: decode log `data` with w3.eth.abi (window.Web3.eth.abi can be undefined in some builds)
// Result: amount/term are now populated; maturity/status render correctly in table + calendar.
(function () {
  // Get chain-specific contract address
  const CONTRACT_ADDRESS = (window.chainManager?.getContractAddress('XEN_CRYPTO') || 
    window.appConfig?.contracts?.XEN_ETH || 
    "0x06450dee7fd2fb8e39061434babcfc05599a6fb8").toLowerCase();
  const DEFAULT_RPC = window.chainManager?.getCurrentConfig()?.rpcUrls?.default || 
    window.appConfig?.rpc?.DEFAULT_RPC || 
    "https://ethereum-rpc.publicnode.com";
  const MIN_CONTRACT_BLOCK = 15700000;
  const SCAN_BACKTRACK_BLOCKS = 1000;

  // Throttle (2 req/sec)
  const RATE_PER_SEC = 1;
  const MIN_INTERVAL_MS = Math.ceil(1000 / RATE_PER_SEC);
  let __lastCallAt = 0;
  async function throttle() {
    const now = Date.now();
    const wait = Math.max(0, __lastCallAt + MIN_INTERVAL_MS - now);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    __lastCallAt = Date.now();
  }

  // Utils
  // cleanHexAddr function now provided by js/utils/stringUtils.js module
  // padTopicAddress, fmtLocalDateTime, and dayKeyLocal functions now provided by modules
  // padTopicAddress -> js/utils/stringUtils.js
  // fmtLocalDateTime, dayKeyLocal -> js/utils/dateUtils.js

  // IDB
  const STORE="stakes", STORE_ST="scanState";
  function openDB(){return new Promise((resolve,reject)=>{
    // Get chain-specific database name
    const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
    const chainPrefix = currentChain === 'BASE' ? 'BASE' : 'ETH';
    const dbName = `${chainPrefix}_DB-Xen-Stake`;
    const req=indexedDB.open(dbName,1);
    req.onupgradeneeded=e=>{const db=e.target.result;
      if(!db.objectStoreNames.contains(STORE)){const os=db.createObjectStore(STORE,{keyPath:"id"}); os.createIndex("byOwner","owner",{unique:false});}
      if(!db.objectStoreNames.contains(STORE_ST)){db.createObjectStore(STORE_ST,{keyPath:"address"});}
    };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });}
  function getByOwner(db, owner){return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly"); const idx=tx.objectStore(STORE).index("byOwner");
    const req=idx.getAll(owner); req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error);
  });}
  function saveRow(db,row){return new Promise((resolve,reject)=>{
    if(!row||!row.id){console.warn("[XenStake] Not saving row without id:",row); resolve(); return;}
    const tx=db.transaction(STORE,"readwrite"); tx.objectStore(STORE).put(row).onsuccess=()=>resolve(); tx.onerror=e=>reject(e.target.error);
  });}
  function getScanState(db,address){address=cleanHexAddr(address);return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_ST,"readonly"); tx.objectStore(STORE_ST).get(address).onsuccess=e=>resolve(e.target.result||null); tx.onerror=e=>reject(e.target.error);
  });}
  function putScanState(db,address,last){address=cleanHexAddr(address);return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_ST,"readwrite"); tx.objectStore(STORE_ST).put({address,lastScannedBlock:Number(last)||0}).onsuccess=()=>resolve(); tx.onerror=e=>reject(e.target.error);
  });}
  function clearScanState(db,address){address=cleanHexAddr(address);return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_ST,"readwrite"); tx.objectStore(STORE_ST).delete(address).onsuccess=()=>resolve(); tx.onerror=e=>reject(e.target.error);
  });}

  // Web3 + RPC
  function getRpcList(){const ta=document.getElementById("customRPC"); const raw=(ta&&ta.value.trim())||localStorage.getItem("customRPC")||DEFAULT_RPC; return raw.split(/\s+|\n+/).map(s=>s.trim()).filter(Boolean);}
  function newWeb3(){const list=getRpcList(); const provider=new window.Web3.providers.HttpProvider(list[0]); const w3=new window.Web3(provider); w3.__rpcList=list; w3.__rpcIndex=0; return w3;}
  function rotateRpc(w3){ if(!w3.__rpcList||!w3.__rpcList.length) return; w3.__rpcIndex=(w3.__rpcIndex+1)%w3.__rpcList.length; const next=w3.__rpcList[w3.__rpcIndex]; try{w3.setProvider(new window.Web3.providers.HttpProvider(next));}catch{} const stat=document.getElementById("rpcStatus"); if(stat) stat.textContent=` via ${next}`; }

  // Logs API
  async function fetchLogsOnce(apiKey, params){
    const qs=new URLSearchParams(params).toString();
    // Get explorer API URL for current chain
    const explorerUrl = window.chainManager?.getCurrentConfig()?.explorer?.apiUrl || 'https://api.etherscan.io/api';
    const url=`${explorerUrl}?module=logs&action=getLogs&${qs}&apikey=${apiKey}`;
    await throttle();
    const res=await fetch(url); if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json().catch(()=>({status:"0",message:"bad json"})); return data;
  }
  async function fetchLogsSplit(apiKey, params, sink, depth=0, attempt=1){
    try{
      const data=await fetchLogsOnce(apiKey, params);
      if (data.status==="1" && Array.isArray(data.result)) { sink.push(...data.result); return; }
      const msg=`${data.message||""} ${data.result||""}`;
      if (/Max calls per sec rate limit reached/i.test(msg)) {
        const backoff=Math.min(4000, 600*attempt);
        await new Promise(r=>setTimeout(r, backoff));
        return fetchLogsSplit(apiKey, params, sink, depth, attempt+1);
      }
      if (/window is too large|reduce the range/i.test(msg) && depth<18){
        const from=Number(params.fromBlock), to=Number(params.toBlock); if (!(Number.isFinite(from)&&Number.isFinite(to)&&to>from)) throw new Error(msg);
        const mid=Math.floor((from+to)/2);
        await fetchLogsSplit(apiKey, {...params, toBlock:String(mid)}, sink, depth+1, 1);
        await fetchLogsSplit(apiKey, {...params, fromBlock:String(mid+1)}, sink, depth+1, 1);
        return;
      }
      if (/no records found/i.test(msg)) return;
      throw new Error(msg||"logs error");
    } catch(e){
      if (attempt<=5){ const backoff=Math.min(5000, 800*attempt); await new Promise(r=>setTimeout(r, backoff)); return fetchLogsSplit(apiKey, params, sink, depth, attempt+1); }
      throw e;
    }
  }

  // Core scan
  async function scan(){
    const addrs=(function(){const el=document.getElementById("ethAddress"); const raw=(el&&el.value)||localStorage.getItem("ethAddress")||""; const arr=raw.replace(/[;,]+/g,"\n").split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>s.toLowerCase()); const seen=new Set(); return arr.filter(a=>seen.has(a)?false:(seen.add(a),true));})();
    const apiKey=(document.getElementById("etherscanApiKey")?.value||"").trim();
    const forceRescan=!!document.getElementById("forceRescan")?.checked;
    if(!addrs.length){alert("Add at least one address in Settings to scan Stakes.");return;}
    if(!apiKey){alert("An Etherscan API Key is required to scan Stakes.");return;}

    const w3=newWeb3();
    const db=await openDB();
    const addrLbl=document.getElementById("addressProgressText");
    const tokenBar=document.getElementById("tokenProgressBar");
    const tokenTxt=document.getElementById("tokenProgressText");
    const etrEl=document.getElementById("etrText");
    const progWrap=document.getElementById("progressContainer"); if (window.progressUI) { window.progressUI.show(true); window.progressUI.setType('Stakes'); } else if (progWrap) progWrap.style.display="block";

    // constants for APY calc (ABI moved to ./ABI/xen-ABI.js)
    const xen = new w3.eth.Contract(window.xenAbi, CONTRACT_ADDRESS);
    let genesisTs=1665187200, SECONDS_IN_DAY=86400;
    try{ genesisTs=Number(await xen.methods.genesisTs().call())||genesisTs; }catch{}
    try{ SECONDS_IN_DAY=Number(await xen.methods.SECONDS_IN_DAY().call())||86400; }catch{}
    function apyAt(ts){ const START=20, END=2, STEP=90*SECONDS_IN_DAY; const dec=Math.floor(Math.max(0, ts-genesisTs)/STEP); const apy=START-dec; return apy<END?END:apy; }

    const topicStake    = w3.utils.sha3("Staked(address,uint256,uint256)");
    const topicWithdraw = w3.utils.sha3("Withdrawn(address,uint256,uint256)");

    const getChunkSize=(window.getChunkSize||(()=>50000)); let CHUNK_SIZE=Number(getChunkSize())||50000;
    if(!Number.isFinite(CHUNK_SIZE)) CHUNK_SIZE=50000; CHUNK_SIZE=Math.max(10000, Math.min(CHUNK_SIZE, 500000));

    const updateStatus=(m)=>{ if(tokenTxt) tokenTxt.textContent=m; };
    window.__scanLastActivityTs=Date.now();
    const heartbeat=setInterval(()=>{ const dt=Math.floor((Date.now()-(window.__scanLastActivityTs||Date.now()))/1000); if(etrEl) etrEl.textContent=dt>=3?`\u23F3 ${dt}s since last reply`:""; },1000);

    try{
      for(let a=0; a<addrs.length; a++){
        const addr=cleanHexAddr(addrs[a]);
        try{
          const latestBlock=await w3.eth.getBlockNumber();
          if (addrLbl) addrLbl.textContent=`Scanning address ${a+1}/${addrs.length}: ${addr.slice(0,6)}…${addr.slice(-4)}`;

          if (forceRescan) await clearScanState(db, addr);
          const st=await getScanState(db, addr);
          const baseStart = st ? (st.lastScannedBlock + 1) : MIN_CONTRACT_BLOCK;
          const resumeFrom= Math.max(MIN_CONTRACT_BLOCK, baseStart - SCAN_BACKTRACK_BLOCKS);

          const totalBlocks=Math.max(0, latestBlock - resumeFrom + 1);
          const totalChunks=Math.max(1, Math.ceil(totalBlocks/CHUNK_SIZE));
          const prevBarMax=tokenBar?tokenBar.max:0, prevBarVal=tokenBar?tokenBar.value:0;
          if (tokenBar) { tokenBar.max=totalChunks; tokenBar.value=0; }
          let chunksDone=0, lastUiUpdate=0; const startedAt=Date.now();

          let stakesCache=await getByOwner(db, addr);
          const refreshStakesCache=async()=>{ stakesCache=await getByOwner(db, addr); };

          for(let startBlock=resumeFrom; startBlock<=latestBlock; startBlock+=CHUNK_SIZE){
            const endBlock=Math.min(startBlock+CHUNK_SIZE-1, latestBlock);
            const topic1=padTopicAddress(addr);
            const sinkStake=[], sinkWd=[];

            await fetchLogsSplit(apiKey, {fromBlock:String(startBlock), toBlock:String(endBlock), address:CONTRACT_ADDRESS, topic0:topicStake, topic1:topic1}, sinkStake);
            await fetchLogsSplit(apiKey, {fromBlock:String(startBlock), toBlock:String(endBlock), address:CONTRACT_ADDRESS, topic0:topicWithdraw, topic1:topic1}, sinkWd);

            const items=[]; for(const ev of sinkStake) items.push({kind:"stake", ev}); for(const ev of sinkWd) items.push({kind:"withdraw", ev});
            items.sort((a,b)=>{ const ba=Number(BigInt(a.ev.blockNumber)), bb=Number(BigInt(b.ev.blockNumber)); if(ba!==bb) return ba-bb; const la=Number(BigInt(a.ev.logIndex||"0x0")), lb=Number(BigInt(b.ev.logIndex||"0x0")); return la-lb; });

            if(items.length){
              updateStatus(`Processing ${items.length} stake logs…`);
              for(let i=0;i<items.length;i++){
                const it=items[i], ev=it.ev;
                const hash=ev.transactionHash;
                const bnum=Number(BigInt(ev.blockNumber));
                const tsHex=ev.timeStamp;
                const tsSec= tsHex ? Number(BigInt(tsHex)) : (await (async()=>{ try{ const b=await w3.eth.getBlock(bnum); return Number(b?.timestamp||0);}catch{return 0;} })());

                if (it.kind==="stake"){
                  let amountWei=0n, termDays=0;
                  try{
                    const dataHex = ev.data || "0x";
                    const decoded = w3.eth.abi.decodeParameters(["uint256","uint256"], dataHex);
                    amountWei = BigInt(decoded[0].toString());
                    termDays  = Number(decoded[1]) || 0;
                  } catch{}

                  // ✅ FIX: Define a unique 'id' for the stake record.
                  const id = `${addr}-${hash}`;

                  const TOK = 10n ** 18n;
                  const amountTokens = (amountWei >= 0n) ? (amountWei / TOK) : 0n;
                  const maturityTs = tsSec + termDays * 86400;
                  const apy = apyAt(tsSec);
                  const _status = maturityTs <= Math.floor(Date.now() / 1000) ? "Claimable" : "Maturing";

                  const row = {
                    id, // Now defined
                    owner: addr,
                    amount: amountTokens.toString(),
                    amountWei: amountWei.toString(),
                    term: termDays,
                    apy,
                    startTs: tsSec, // ✅ FIX: Use tsSec
                    maturityTs,
                    Maturity_Date_Fmt: fmtLocalDateTime(maturityTs),
                    maturityDateOnly: dayKeyLocal(maturityTs),
                    SourceType: "Stake",
                    status: _status,
                    Status: _status,
                    actions: [{ type: "stake", hash, timeStamp: tsSec }], // ✅ FIX: Use tsSec
                  };

                  await saveRow(db, row);
                  stakesCache.push(row);
                } else {
                  const latestOpen = stakesCache.slice().sort((a,b)=>(b.startTs||0)-(a.startTs||0))
                    .find(r => !(Array.isArray(r.actions)&&r.actions.some(x=>x.type==="withdraw")));
                  if (latestOpen){
                    // ✅ FIX: Use the correct 'tsSec' variable.
                    const withdrawTs = tsSec;
                    const matured = (Number(latestOpen.maturityTs) || 0) <= withdrawTs;
                    const newStatus = matured ? "Claimed" : "Ended Early";

                    // update both keys so all UI paths see it
                    latestOpen.status = newStatus;   // original
                    latestOpen.Status = newStatus;   // TitleCase mirror

                    latestOpen.actions = Array.isArray(latestOpen.actions)
                      ? latestOpen.actions
                      : [];
                    if (!latestOpen.actions.some((a) => a.hash === hash)) {
                      latestOpen.actions.push({
                        type: "withdraw",
                        hash,
                        timeStamp: withdrawTs,
                      });
                    }
                    await saveRow(db, latestOpen);
                    if (i%10===0) await refreshStakesCache();
                  } else {
                    await refreshStakesCache();
                  }
                }
              }
            } else {
              if (tokenTxt) tokenTxt.textContent=`No XEN stake activity ${startBlock}–${endBlock}`;
            }

            await putScanState(db, addr, endBlock);
            chunksDone++; window.__scanLastActivityTs=Date.now();
            if (tokenBar) { tokenBar.max=totalChunks; tokenBar.value=chunksDone; }
            const now=Date.now();
            if (now-lastUiUpdate>300){
              const elapsed=(now-startedAt)/1000, rate=chunksDone/Math.max(1,elapsed);
              const remainingChunks=Math.max(0,totalChunks-chunksDone);
              const remainingSec= rate>0 ? remainingChunks/rate : 0;
              if (etrEl) etrEl.textContent = isFinite(remainingSec)?`ETA: ${Math.round(remainingSec)}s`:"";
              lastUiUpdate=now;
            }
          }

          if (tokenBar) { tokenBar.max=prevBarMax; tokenBar.value=prevBarVal; }
        } catch(err){
          console.error("[XenStake] Scan failed for", addr, err);
          if (tokenTxt) tokenTxt.textContent=`Error scanning ${addr.slice(0,6)}…`;
          rotateRpc(w3);
        }
      }
    } finally { clearInterval(heartbeat); }

    const tokenTxt2=document.getElementById("tokenProgressText");
    if (tokenTxt2) tokenTxt2.textContent="Stake scan complete.";
    setTimeout(()=>{ if(!window.__scanAllActive){ if(window.progressUI) window.progressUI.show(false); else { const prog=document.getElementById("progressContainer"); if (prog) prog.style.display="none"; } } },1200);
  }

// Helper to get ALL records from a store, not just by owner index
  function getAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = e => resolve(e.target.result || []);
        req.onerror = e => reject(e.target.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  // ✅ FIX: The getAll function now correctly fetches and returns all records.
  window.xenStake = {
    CONTRACT_ADDRESS,
    openDB,
    getAll: (db) => getAllFromStore(db, STORE), // Use the new helper to get everything
    scan
  };
})();
