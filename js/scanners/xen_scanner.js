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
  const MIN_CONTRACT_BLOCK = window.chainManager?.getXenDeploymentBlock() || 15704871;
  const SCAN_BACKTRACK_BLOCKS = 1000;

  // Throttle (more conservative - 3 req/sec to avoid rate limits)
  const RATE_PER_SEC = 3;
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

  // Ensure functions are available
  const cleanHexAddr = window.cleanHexAddr || (addr => String(addr || "").trim().toLowerCase());
  const padTopicAddress = window.padTopicAddress || (addr => "0x" + "0".repeat(24) + addr.replace(/^0x/, "").toLowerCase());
  const fmtLocalDateTime = window.fmtLocalDateTime || (ts => new Date(ts * 1000).toLocaleString());
  const dayKeyLocal = window.dayKeyLocal || (ts => new Date(ts * 1000).toISOString().split('T')[0]);

  // IDB
  const STORE="stakes", STORE_ST="scanState";
  function openDB(){return new Promise((resolve,reject)=>{
    // Get chain-specific database name from chainManager
    const dbName = window.chainManager?.getDatabaseName('xen_stake') || 'ETH_DB_XenStake';
    const req=indexedDB.open(dbName,1);
    req.onupgradeneeded=e=>{const db=e.target.result;
      console.log(`[XenStake] Database upgrade needed for ${dbName}, creating stores...`);
      if(!db.objectStoreNames.contains(STORE)){const os=db.createObjectStore(STORE,{keyPath:"id"}); os.createIndex("byOwner","owner",{unique:false});}
      if(!db.objectStoreNames.contains(STORE_ST)){db.createObjectStore(STORE_ST,{keyPath:"address"});}
      if(!db.objectStoreNames.contains("processProgress")){db.createObjectStore("processProgress",{keyPath:"address"});}
    };
    req.onsuccess=()=>{
      const db = req.result;
      // Check if required stores exist, if not, need to recreate database with higher version
      if (!db.objectStoreNames.contains(STORE)) {
        console.warn(`[XenStake] Database ${dbName} exists but missing required stores. Attempting to recreate...`);
        db.close();
        // Delete and recreate database
        const deleteReq = indexedDB.deleteDatabase(dbName);
        deleteReq.onsuccess = () => {
          // Recursively call openDB to recreate with upgrade
          openDB().then(resolve).catch(reject);
        };
        deleteReq.onerror = () => reject(deleteReq.error);
        return;
      }
      resolve(db);
    };
    req.onerror=()=>reject(req.error);
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

  function putScanStateWithTransactions(db,address,lastScannedBlock,lastTransactionBlock){address=cleanHexAddr(address);return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_ST,"readwrite");
    const store=tx.objectStore(STORE_ST);

    // Get existing state to preserve lastTransactionBlock if not provided
    const getRequest=store.get(address);
    getRequest.onsuccess=()=>{
      const existing=getRequest.result||{};
      const newState={
        address,
        lastScannedBlock:Number(lastScannedBlock)||0,
        lastTransactionBlock:lastTransactionBlock>0?lastTransactionBlock:(existing.lastTransactionBlock||0),
        lastScannedAt:Date.now()
      };
      store.put(newState).onsuccess=()=>resolve();
    };
    getRequest.onerror=e=>reject(e.target.error);
    tx.onerror=e=>reject(e.target.error);
  });}
  function clearScanState(db,address){address=cleanHexAddr(address);return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_ST,"readwrite"); tx.objectStore(STORE_ST).delete(address).onsuccess=()=>resolve(); tx.onerror=e=>reject(e.target.error);
  });}

  // Process progress tracking for crash recovery
  function getProcessProgress(db,address){address=cleanHexAddr(address);return new Promise((resolve,reject)=>{
    const tx=db.transaction("processProgress","readonly"); tx.objectStore("processProgress").get(address).onsuccess=e=>resolve(e.target.result||null); tx.onerror=e=>reject(e.target.error);
  });}
  function saveProcessProgress(db,address,currentChunk,processedInChunk,totalProcessed,lastProcessedHash){address=cleanHexAddr(address);return new Promise((resolve,reject)=>{
    const tx=db.transaction("processProgress","readwrite");
    const progress={address,currentChunk:Number(currentChunk)||0,processedInChunk:Number(processedInChunk)||0,totalProcessed:Number(totalProcessed)||0,lastProcessedHash:lastProcessedHash||"",updatedAt:Date.now()};
    tx.objectStore("processProgress").put(progress).onsuccess=()=>resolve(); tx.onerror=e=>reject(e.target.error);
  });}
  function clearProcessProgress(db,address){address=cleanHexAddr(address);return new Promise((resolve,reject)=>{
    const tx=db.transaction("processProgress","readwrite"); tx.objectStore("processProgress").delete(address).onsuccess=()=>resolve(); tx.onerror=e=>reject(e.target.error);
  });}

  // Web3 + RPC
  function getRpcList(){const ta=document.getElementById("customRPC"); if(ta&&ta.value.trim()){return ta.value.trim().split(/\s+|\n+/).map(s=>s.trim()).filter(Boolean);} if(window.chainManager){const rpcs=window.chainManager.getRPCEndpoints(); return rpcs.length>0?rpcs:[DEFAULT_RPC];} return [DEFAULT_RPC];}
  function newWeb3(){const list=getRpcList(); const provider=new window.Web3.providers.HttpProvider(list[0]); const w3=new window.Web3(provider); w3.__rpcList=list; w3.__rpcIndex=0; return w3;}
  function rotateRpc(w3){ if(!w3.__rpcList||!w3.__rpcList.length) return; w3.__rpcIndex=(w3.__rpcIndex+1)%w3.__rpcList.length; const next=w3.__rpcList[w3.__rpcIndex]; try{w3.setProvider(new window.Web3.providers.HttpProvider(next));}catch{} const stat=document.getElementById("rpcStatus"); if(stat) stat.textContent=` via ${next}`; }

  // Logs API
  async function fetchLogsOnce(apiKey, params){
    const qs=new URLSearchParams(params).toString();
    // Use Etherscan V2 multichain API for all chains
    const chainId = window.chainManager?.getCurrentConfig()?.id || 1;
    const url=`https://api.etherscan.io/v2/api?chainid=${chainId}&module=logs&action=getLogs&${qs}&apikey=${apiKey}`;
    await throttle();

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const res = await fetch(url, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(()=>({status:"0",message:"bad json"}));
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error(`[XEN] Request timeout for URL: ${url}`);
        return {status:"0", message:"Request timeout"};
      }
      throw error;
    }
  }
  async function fetchLogsSplit(apiKey, params, sink, depth=0, attempt=1){
    try{
      const data=await fetchLogsOnce(apiKey, params);
      if (data.status==="1" && Array.isArray(data.result)) { sink.push(...data.result); return; }
      const msg=`${data.message||""} ${data.result||""}`;
      if (/Max calls per sec rate limit reached/i.test(msg)) {
        // Progressive backoff for rate limits - start with longer wait
        const backoff=Math.min(10000, 2000 + (1500 * attempt));
        console.warn(`Rate limit hit. Waiting ${backoff}ms before retry (attempt ${attempt})...`);
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

  // --- Fast XEN Stakes scanning using unified method for all chains ---
  async function scanStakesEventBased(addr, etherscanApiKey) {
    const currentChain = window.chainManager?.getCurrentChain?.() || 'ETHEREUM';
    // Starting event-based scanning

    try {
      // Use exact same Web3 instance creation as working scanner
      const w3 = newWeb3();

      // Get the correct contract address for current chain
      const xenContractAddress = window.chainManager?.getContractAddress('XEN_CRYPTO') || CONTRACT_ADDRESS;
      console.log(`🔍 Using XEN contract: ${xenContractAddress} on ${currentChain}`);

      // Get genesis timestamp for APY calculation
      const xen = new w3.eth.Contract(window.xenAbi, xenContractAddress);
      let genesisTs = 1665187200, SECONDS_IN_DAY = 86400;
      try { genesisTs = Number(await xen.methods.genesisTs().call()) || genesisTs; } catch {}
      try { SECONDS_IN_DAY = Number(await xen.methods.SECONDS_IN_DAY().call()) || 86400; } catch {}

      // APY calculation function (same as working scanner)
      const apyAt = (ts) => {
        const START = 20, END = 2, STEP = 90 * SECONDS_IN_DAY;
        const dec = Math.floor(Math.max(0, ts - genesisTs) / STEP);
        const apy = START - dec;
        return apy < END ? END : apy;
      };

      // Use exact same topic calculation as working scanner
      const topicStaked = w3.utils.sha3("Staked(address,uint256,uint256)");
      const topicWithdrawn = w3.utils.sha3("Withdrawn(address,uint256,uint256)");

      // Use exact same address padding as working scanner
      const userAddressTopic = padTopicAddress(addr);

      const stakes = [];

      try {
        // Fetch Staked events using exact same method as working scanner
        const sinkStaked = [];
        await fetchLogsSplit(etherscanApiKey, {
          fromBlock: "0",
          toBlock: "latest",
          address: xenContractAddress,
          topic0: topicStaked,
          topic1: userAddressTopic
        }, sinkStaked);

        // Processing staked events

        for (const event of sinkStaked) {
          // Decode the event data like the working scanner does
          let amountWei = 0n, termDays = 0;
          try {
            const dataHex = event.data || "0x";
            const decoded = w3.eth.abi.decodeParameters(["uint256","uint256"], dataHex);
            amountWei = BigInt(decoded[0].toString());
            termDays = Number(decoded[1]) || 0;
          } catch(e) {
            console.warn(`XEN Stakes Scanner - Could not decode event data for ${event.transactionHash}:`, e);
          }

          const blockNumber = Number(BigInt(event.blockNumber));
          const timeStamp = Number(BigInt(event.timeStamp || "0x0"));

          const TOK = 10n ** 18n;
          const amountTokens = (amountWei >= 0n) ? (amountWei / TOK) : 0n;
          const maturityTs = timeStamp + termDays * 86400;
          const apy = apyAt(timeStamp);
          const status = maturityTs <= Math.floor(Date.now() / 1000) ? "Claimable" : "Maturing";

          // Format dates using Luxon like other scanners for consistency
          let Maturity_Date_Fmt = "", maturityDateOnly = "";
          try {
            if (typeof window.luxon !== "undefined" && window.luxon.DateTime) {
              const dt = window.luxon.DateTime.fromSeconds(maturityTs);
              Maturity_Date_Fmt = dt.toFormat("yyyy LLL dd, hh:mm a");
              maturityDateOnly = dt.toFormat("yyyy-MM-dd");
              // Using Luxon formatting
            } else {
              // Luxon not available, using manual fallback
              // Manual fallback to match other scanners' format exactly
              const d = new Date(maturityTs * 1000);
              const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              const day = String(d.getDate()).padStart(2, "0");
              let hour = d.getHours();
              const ampm = hour >= 12 ? "PM" : "AM";
              hour = hour % 12 || 12;
              const minute = String(d.getMinutes()).padStart(2, "0");

              Maturity_Date_Fmt = `${d.getFullYear()} ${months[d.getMonth()]} ${day}, ${String(hour).padStart(2, "0")}:${minute} ${ampm}`;
              maturityDateOnly = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${day}`;
              // Manual fallback formatting complete
            }
          } catch (e) {
            console.warn(`XEN Stakes Scanner - Date formatting error:`, e);
            // Manual fallback in case of error too
            const d = new Date(maturityTs * 1000);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const day = String(d.getDate()).padStart(2, "0");
            let hour = d.getHours();
            const ampm = hour >= 12 ? "PM" : "AM";
            hour = hour % 12 || 12;
            const minute = String(d.getMinutes()).padStart(2, "0");

            Maturity_Date_Fmt = `${d.getFullYear()} ${months[d.getMonth()]} ${day}, ${String(hour).padStart(2, "0")}:${minute} ${ampm}`;
            maturityDateOnly = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${day}`;
            // Error fallback formatting complete
          }

          const stakeRow = {
            id: `${addr}-${event.transactionHash}`,
            owner: addr,
            amount: amountTokens.toString(),
            amountWei: amountWei.toString(),
            term: termDays,
            apy,
            startTs: timeStamp,
            maturityTs,
            Maturity_Date_Fmt,
            maturityDateOnly,
            SourceType: "Stake",
            status: status,
            Status: status,
            actions: [{ type: "stake", hash: event.transactionHash, timeStamp: timeStamp }]
          };

          stakes.push(stakeRow);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));

        // Fetch Withdrawn events using exact same method
        const sinkWithdrawn = [];
        await fetchLogsSplit(etherscanApiKey, {
          fromBlock: "0",
          toBlock: "latest",
          address: xenContractAddress,
          topic0: topicWithdrawn,
          topic1: userAddressTopic
        }, sinkWithdrawn);

        // Processing withdrawn events

        // Process Withdrawn events and update corresponding stakes
        for (const event of sinkWithdrawn) {
          const withdrawTs = Number(BigInt(event.timeStamp || "0x0"));
          const withdrawHash = event.transactionHash;

          // Find the corresponding stake (simplified matching by oldest active stake)
          const activeStake = stakes.find(stake => stake.status === 'Maturing' || stake.status === 'Claimable');
          if (activeStake) {
            const matured = (Number(activeStake.maturityTs) || 0) <= withdrawTs;
            const newStatus = matured ? "Claimed" : "Ended Early";

            activeStake.status = newStatus;
            activeStake.Status = newStatus;

            // Add withdraw action
            if (!activeStake.actions.some(a => a.hash === withdrawHash)) {
              activeStake.actions.push({
                type: "withdraw",
                hash: withdrawHash,
                timeStamp: withdrawTs,
              });
            }
          }
        }

      } catch (error) {
        console.error(`XEN Stakes Scanner - Error using fetchLogsSplit:`, error);
        return null; // Signal fallback needed
      }

      // Event scan complete
      return stakes;

    } catch (error) {
      console.error(`XEN Stakes Scanner - Event-based scanning failed for ${addr} on ${currentChain}:`, error);
      return null; // Signal fallback needed
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
          if (addrLbl) addrLbl.textContent=`Scanning address ${a+1}/${addrs.length}: ${addr.slice(0,6)}…${addr.slice(-4)}`;

          // Try new fast event-based scanning first
          if (window.progressUI) {
            window.progressUI.setStage(`Using fast XEN Stakes scanning...`, 1, 1);
          }

          try {
            console.log('🚀 XEN Stakes Scanner - Calling unified event-based scanner...');
            updateStatus(`Using fast event-based scanning for ${addr.slice(0,6)}...`);

            const eventStakes = await scanStakesEventBased(addr, apiKey);
            if (eventStakes !== null) {
              updateStatus(`Processing ${eventStakes.length} event-based stakes...`);

              // Process and save the event-based stakes (they're already in the right format)
              for (const stake of eventStakes) {
                await saveRow(db, stake);
              }

              updateStatus(`✅ Event-based scan completed: ${eventStakes.length} stakes saved for ${addr.slice(0,6)}...`);
              // Clear progress on successful completion
              await clearProcessProgress(db, addr);
              continue; // Skip old scanning logic for this address
            }
          } catch (eventScanError) {
            updateStatus(`Event scan failed, using fallback method...`);
          }

          // Fallback to old block-based scanning if event-based fails
          const latestBlock=await w3.eth.getBlockNumber();

          if (forceRescan) {
            await clearScanState(db, addr);
            await clearProcessProgress(db, addr);
          }
          const st=await getScanState(db, addr);

          // Use safety buffer approach: always rescan from before last transaction
          const SAFETY_BUFFER_BLOCKS = 100; // Larger buffer for block-based scanning
          const lastTransactionBlock = st?.lastTransactionBlock || 0;
          const lastScannedBlock = st?.lastScannedBlock || 0;

          const safeStartBlock = lastTransactionBlock > 0
            ? Math.max(lastTransactionBlock - SAFETY_BUFFER_BLOCKS, MIN_CONTRACT_BLOCK)
            : Math.max(MIN_CONTRACT_BLOCK, lastScannedBlock + 1 - SCAN_BACKTRACK_BLOCKS);

          const resumeFrom = safeStartBlock;

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

            // Fetch stake events first
            await fetchLogsSplit(apiKey, {fromBlock:String(startBlock), toBlock:String(endBlock), address:CONTRACT_ADDRESS, topic0:topicStake, topic1:topic1}, sinkStake);
            
            // Small delay between different event types to avoid rate limits
            await new Promise(r => setTimeout(r, 100));
            
            // Then fetch withdraw events
            await fetchLogsSplit(apiKey, {fromBlock:String(startBlock), toBlock:String(endBlock), address:CONTRACT_ADDRESS, topic0:topicWithdraw, topic1:topic1}, sinkWd);

            const items=[]; for(const ev of sinkStake) items.push({kind:"stake", ev}); for(const ev of sinkWd) items.push({kind:"withdraw", ev});
            items.sort((a,b)=>{ const ba=Number(BigInt(a.ev.blockNumber)), bb=Number(BigInt(b.ev.blockNumber)); if(ba!==bb) return ba-bb; const la=Number(BigInt(a.ev.logIndex||"0x0")), lb=Number(BigInt(b.ev.logIndex||"0x0")); return la-lb; });

            // Track the highest block that actually contains transactions
            let lastBlockWithTransactions = 0;

            if(items.length){
              updateStatus(`Processing ${items.length} stake logs…`);
              // Get process progress for crash recovery
              let processProgress = await getProcessProgress(db, addr);
              let startFromIndex = 0;
              let totalProcessedSoFar = 0;

              if (processProgress && !forceRescan) {
                // Find where to resume in this chunk based on last processed hash
                const lastHash = processProgress.lastProcessedHash;
                if (lastHash) {
                  const resumeIndex = items.findIndex(item => item.ev.transactionHash === lastHash);
                  if (resumeIndex !== -1) {
                    startFromIndex = resumeIndex + 1; // Start after the last processed transaction
                    totalProcessedSoFar = processProgress.totalProcessed || 0;
                    console.log(`[XEN] Resuming from transaction ${startFromIndex}/${items.length} in chunk (hash: ${lastHash.slice(0,10)}...)`);
                  }
                }
              }

              for(let i=startFromIndex;i<items.length;i++){
                const it=items[i], ev=it.ev;
                const hash=ev.transactionHash;
                const bnum=Number(BigInt(ev.blockNumber));
                const tsHex=ev.timeStamp;

                // Track the highest block number that contains transactions
                lastBlockWithTransactions = Math.max(lastBlockWithTransactions, bnum);
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

                  // Format dates using Luxon like other scanners for consistency
                  let Maturity_Date_Fmt = "", maturityDateOnly = "";
                  try {
                    if (typeof window.luxon !== "undefined" && window.luxon.DateTime) {
                      const dt = window.luxon.DateTime.fromSeconds(maturityTs);
                      Maturity_Date_Fmt = dt.toFormat("yyyy LLL dd, hh:mm a");
                      maturityDateOnly = dt.toFormat("yyyy-MM-dd");
                    } else {
                      // Fallback if Luxon not available
                      Maturity_Date_Fmt = fmtLocalDateTime(maturityTs);
                      maturityDateOnly = dayKeyLocal(maturityTs);
                    }
                  } catch (e) {
                    console.warn(`XEN Stakes Scanner - Date formatting error:`, e);
                    Maturity_Date_Fmt = fmtLocalDateTime(maturityTs);
                    maturityDateOnly = dayKeyLocal(maturityTs);
                  }

                  const row = {
                    id, // Now defined
                    owner: addr,
                    amount: amountTokens.toString(),
                    amountWei: amountWei.toString(),
                    term: termDays,
                    apy,
                    startTs: tsSec, // ✅ FIX: Use tsSec
                    maturityTs,
                    Maturity_Date_Fmt,
                    maturityDateOnly,
                    SourceType: "Stake",
                    status: _status,
                    Status: _status,
                    actions: [{ type: "stake", hash, timeStamp: tsSec }], // ✅ FIX: Use tsSec
                  };

                  await saveRow(db, row);
                  stakesCache.push(row);
                  // Save progress after each transaction for crash recovery
                  await saveProcessProgress(db, addr, chunksDone, i + 1, totalProcessedSoFar + i + 1, hash);
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
                    // Save progress after each transaction for crash recovery
                    await saveProcessProgress(db, addr, chunksDone, i + 1, totalProcessedSoFar + i + 1, hash);
                    if (i%10===0) await refreshStakesCache();
                  } else {
                    await refreshStakesCache();
                    // Save progress even when no matching stake found
                    await saveProcessProgress(db, addr, chunksDone, i + 1, totalProcessedSoFar + i + 1, hash);
                  }
                }
              }
            } else {
              if (tokenTxt) tokenTxt.textContent=`No XEN stake activity ${startBlock}–${endBlock}`;
            }

            // Always update progress, but track last transaction block separately for safety buffer
            await putScanStateWithTransactions(db, addr, endBlock, lastBlockWithTransactions);

            if (lastBlockWithTransactions > 0) {
              console.log(`[XEN] Processed ${items.length} transactions, highest block: ${lastBlockWithTransactions}`);
            } else {
              console.log(`[XEN] No transactions found in blocks ${startBlock}-${endBlock}`);
            }
            chunksDone++; window.__scanLastActivityTs=Date.now();
            if (tokenBar) { tokenBar.max=totalChunks; tokenBar.value=chunksDone; }
            const now=Date.now();
            if (now-lastUiUpdate>300){
              const elapsed=(now-startedAt)/1000, rate=chunksDone/Math.max(1,elapsed);
              const remainingChunks=Math.max(0,totalChunks-chunksDone);
              const remainingSec= rate>0 ? remainingChunks/rate : 0;
              if (etrEl) {
                if (isFinite(remainingSec)) {
                  const totalSecs = Math.round(remainingSec);
                  if (totalSecs < 60) {
                    etrEl.textContent = `ETA: ${totalSecs}s`;
                  } else {
                    const mins = Math.floor(totalSecs / 60);
                    const secs = totalSecs % 60;
                    etrEl.textContent = `ETA: ${mins}m ${secs}s`;
                  }
                } else {
                  etrEl.textContent = "";
                }
              }
              lastUiUpdate=now;
            }
          }

          if (tokenBar) { tokenBar.max=prevBarMax; tokenBar.value=prevBarVal; }
          // Clear process progress on successful completion of address scanning
          await clearProcessProgress(db, addr);
          console.log(`[XEN] Chunk-based scan completed successfully for ${addr} - cleared process progress`);
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
        // Check if the store exists before creating transaction
        if (!db.objectStoreNames.contains(storeName)) {
          console.error(`[XenStake] Store '${storeName}' not found in database. Available stores:`, Array.from(db.objectStoreNames));
          resolve([]); // Return empty array instead of failing
          return;
        }

        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = e => resolve(e.target.result || []);
        req.onerror = e => reject(e.target.error);
      } catch (e) {
        console.error(`[XenStake] Error accessing store '${storeName}':`, e);
        resolve([]); // Return empty array instead of failing
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
