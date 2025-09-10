# WenXen.com - Complete System Flow Diagrams

## High-Level Application Architecture

```mermaid
graph TB
    subgraph "Frontend Application"
        A[index.html] --> B[Main App Controller]
        B --> C[Tab Manager]
        B --> D[Theme Manager]
        B --> E[Chain Manager]
        B --> F[Wallet Manager]
        
        C --> G[Dashboard Tab]
        C --> H[Settings Tab]
        C --> I[Mint Tab]
        C --> J[About Tab]
        
        G --> K[Unified View]
        G --> L[Calendar Widget]
        G --> M[Summary Stats]
        
        K --> N[Tabulator Table]
        K --> O[Filter System]
        K --> P[Export Functions]
    end
    
    subgraph "Data Processing Layer"
        Q[Scanner Orchestrator]
        R[Fast Token Scanner]
        S[Legacy Block Scanner]
        T[Cointool Scanner]
        U[XENFT Scanner]
        V[XEN Stake Scanner]
        W[XENFT Stake Scanner]
    end
    
    subgraph "Storage Layer"
        X[IndexedDB Manager]
        Y[Chain-Specific Databases]
        Z[LocalStorage Utils]
        AA[Migration System]
    end
    
    subgraph "External Services"
        BB[Etherscan API]
        CC[BaseScan API]
        DD[Blockchain RPCs]
        EE[MetaMask/Rabby]
        FF[CoinGecko API]
    end
    
    B --> Q
    Q --> R
    Q --> S
    Q --> T
    Q --> U
    Q --> V
    Q --> W
    
    R --> BB
    R --> CC
    S --> DD
    T --> DD
    U --> DD
    V --> DD
    W --> DD
    
    R --> X
    S --> X
    T --> X
    U --> X
    V --> X
    W --> X
    
    X --> Y
    X --> AA
    B --> Z
    
    F --> EE
    B --> FF
    
    K --> X
```

## Application Initialization Flow

```mermaid
sequenceDiagram
    participant Browser
    participant HTML as index.html
    participant Config as Chain Config
    participant Theme as Theme Manager
    participant Tab as Tab Manager
    participant Chain as Chain Manager
    participant Privacy as Privacy Modal
    participant DB as Database
    participant UI as Main UI
    
    Browser->>HTML: Load page
    HTML->>Config: Load chain configurations
    HTML->>Theme: Initialize theme system
    HTML->>Tab: Initialize tab system
    HTML->>Chain: Initialize chain manager
    HTML->>Privacy: Check privacy acceptance
    
    alt Privacy not accepted
        Privacy->>Browser: Show privacy modal
        Browser->>Privacy: User accepts
    end
    
    Privacy->>DB: Initialize databases
    DB->>DB: Run migrations if needed
    DB->>Chain: Setup chain-specific DBs
    
    Chain->>UI: Update chain-specific labels
    Theme->>UI: Apply stored theme
    Tab->>UI: Activate default tab
    
    UI->>Browser: Application ready
```

## Multi-Chain Configuration System

```mermaid
graph TB
    A[Chain Manager] --> B[Chain Config]
    B --> C[Ethereum Config]
    B --> D[Base Config]
    
    C --> E[ETH Contracts]
    C --> F[ETH RPCs]
    C --> G[Etherscan API]
    
    D --> H[Base Contracts]
    D --> I[Base RPCs]
    D --> J[BaseScan API]
    
    A --> K[Current Chain State]
    K --> L[Active Contracts]
    K --> M[Active RPCs]
    K --> N[Active Explorer]
    
    A --> O[Chain Change Events]
    O --> P[Update UI Labels]
    O --> Q[Switch Databases]
    O --> R[Update Scanner Configs]
    
    subgraph "Chain-Specific Resources"
        E
        F
        G
        H
        I
        J
    end
    
    subgraph "Dynamic Configuration"
        L
        M
        N
    end
```

## Scanning System Architecture

```mermaid
graph TB
    A[User Scan Action] --> B[Unified Scan Controller]
    B --> C{Scan Mode Selection}
    
    C -->|All| D[Multi-Scanner Orchestration]
    C -->|Cointool| E[Cointool Scanner]
    C -->|XENFT| F[XENFT Scanner Router]
    C -->|Stakes| G[Stake Scanner]
    C -->|XENFT Stakes| H[XENFT Stake Scanner]
    
    F --> I{Fast Scan Enabled?}
    I -->|Yes| J[Fast XENFT Scanner]
    I -->|No| K[Legacy XENFT Scanner]
    
    D --> E
    D --> J
    D --> G
    D --> H
    
    subgraph "Fast Scanning Pipeline"
        J --> L[Transaction History API]
        L --> M[Token Discovery]
        M --> N[Detail Fetcher]
        N --> O[Blockchain RPC Calls]
        O --> P[Metadata Extraction]
        P --> Q[Database Update]
    end
    
    subgraph "Legacy Scanning Pipeline"
        K --> R[Block Enumeration]
        R --> S[Event Filtering]
        S --> T[Token Validation]
        T --> Q
    end
    
    subgraph "Cointool Pipeline"
        E --> U[Contract Event Logs]
        U --> V[Mint Record Parsing]
        V --> Q
    end
    
    Q --> W[UI Refresh]
    W --> X[Table Update]
    W --> Y[Calendar Update]
    W --> Z[Summary Stats Update]
```

## Fast XENFT Scanning Detail Flow

```mermaid
sequenceDiagram
    participant User
    participant Scanner as Fast Scanner
    participant API as Explorer API
    participant Fetcher as Detail Fetcher
    participant RPC as Blockchain RPC
    participant DB as Database
    participant UI as User Interface
    
    User->>Scanner: Initiate XENFT Scan
    
    loop For each address
        Scanner->>API: Get NFT transfers
        API-->>Scanner: Return transfer history
        Scanner->>Scanner: Extract token IDs
        Scanner->>DB: Store placeholders
    end
    
    Scanner->>Fetcher: Fetch details for discovered tokens
    
    loop For each token
        Fetcher->>RPC: Get vmuCount(tokenId)
        Fetcher->>RPC: Get tokenURI(tokenId)
        Fetcher->>RPC: Get mintInfo(tokenId)
        Fetcher->>RPC: Get xenBurned(tokenId)
        
        Fetcher->>Fetcher: Decode mint info
        Fetcher->>Fetcher: Extract metadata
        Fetcher->>DB: Update with full details
    end
    
    Scanner->>UI: Refresh unified view
    UI->>DB: Fetch complete records
    UI->>User: Display full token details
```

## Database Architecture & Migration System

```mermaid
graph TB
    A[Database Initializer] --> B[Migration System]
    B --> C[Chain Detection]
    C --> D[ETH Database Path]
    C --> E[BASE Database Path]
    
    D --> F[ETH_DB_Cointool]
    D --> G[ETH_DB_Xenft]
    D --> H[ETH_DB_XenftStake]
    D --> I[ETH_DB_Xen]
    
    E --> J[BASE_DB_Cointool]
    E --> K[BASE_DB_Xenft]
    E --> L[BASE_DB_XenftStake]
    E --> M[BASE_DB_Xen]
    
    B --> N[Version Control]
    N --> O[Schema Migrations]
    N --> P[Data Migrations]
    N --> Q[Cleanup Operations]
    
    subgraph "Migration Safety Layers"
        R[Ultra Safe Migration]
        S[Super Safe Migration]
        T[Safe Migration]
        U[Standard Migration]
    end
    
    B --> R
    R --> S
    S --> T
    T --> U
    
    subgraph "Database Operations"
        V[CRUD Operations]
        W[Bulk Operations]
        X[Query Optimization]
        Y[Index Management]
    end
    
    F --> V
    G --> V
    H --> V
    I --> V
    J --> V
    K --> V
    L --> V
    M --> V
```

## UI Component Interaction Flow

```mermaid
graph TB
    A[Tab Manager] --> B[Tab State Persistence]
    A --> C[Tab Event Handling]
    A --> D[Tab Content Loading]
    
    E[Theme Manager] --> F[Theme State Persistence]
    E --> G[CSS Class Management]
    E --> H[External Library Theming]
    
    I[Modal Manager] --> J[Privacy Modal]
    I --> K[Onboarding Modal]
    I --> L[Settings Modal]
    
    M[Tooltip Manager] --> N[Mobile Tooltip Handling]
    M --> O[Desktop Tooltip System]
    M --> P[Long Press Detection]
    
    Q[Network Selector] --> R[Chain Switching]
    Q --> S[Wallet Network Detection]
    Q --> T[Network Mismatch Handling]
    
    U[Wallet Manager] --> V[MetaMask Integration]
    U --> W[Rabby Integration]
    U --> X[Connection State Management]
    
    R --> Y[Chain Configuration Update]
    Y --> Z[Database Path Switch]
    Y --> AA[Scanner Reconfiguration]
    Y --> BB[UI Label Updates]
    
    subgraph "Theme System"
        E
        F
        G
        H
    end
    
    subgraph "Modal System"
        I
        J
        K
        L
    end
    
    subgraph "Wallet Integration"
        U
        V
        W
        X
    end
```

## Data Flow Through Unified View

```mermaid
graph LR
    A[Scanner Results] --> B[Data Aggregator]
    B --> C[Cointool Records]
    B --> D[XENFT Records]
    B --> E[Stake Records]
    B --> F[XENFT Stake Records]
    
    C --> G[Record Mapper]
    D --> G
    E --> G
    F --> G
    
    G --> H[Unified Record Format]
    H --> I[Status Calculator]
    H --> J[Maturity Calculator]
    H --> K[VMU Aggregator]
    
    I --> L[Status Filter]
    J --> M[Date Filter]
    K --> N[VMU Filter]
    
    L --> O[Filtered Dataset]
    M --> O
    N --> O
    
    O --> P[Tabulator Table]
    O --> Q[Calendar Widget]
    O --> R[Summary Statistics]
    
    P --> S[Interactive Filters]
    P --> T[Sort Operations]
    P --> U[Export Functions]
    
    Q --> V[Date Navigation]
    Q --> W[VMU Badges]
    
    R --> X[Total Counts]
    R --> Y[Status Breakdown]
    R --> Z[Maturity Summary]
```

## Wallet Integration & Blockchain Interaction

```mermaid
sequenceDiagram
    participant User
    participant UI as UI Components
    participant Wallet as Wallet Manager
    participant Provider as Web3 Provider
    participant Chain as Chain Manager
    participant Contract as Smart Contracts
    participant Scanner as Scanner System
    
    User->>UI: Click "Connect Wallet"
    UI->>Wallet: Initiate connection
    Wallet->>Provider: Request wallet connection
    Provider-->>Wallet: Connection established
    
    Wallet->>Provider: Get current network
    Provider-->>Wallet: Return chain ID
    Wallet->>Chain: Validate chain compatibility
    
    alt Chain mismatch
        Chain->>UI: Show network mismatch warning
        UI->>User: Prompt to switch network
        User->>Provider: Switch network
        Provider-->>Chain: Confirm network switch
    end
    
    Chain->>UI: Update network display
    Wallet->>UI: Update connection status
    
    User->>UI: Trigger mint/stake operation
    UI->>Contract: Prepare transaction
    Contract->>Provider: Request transaction approval
    Provider-->>User: Show transaction prompt
    User->>Provider: Approve transaction
    Provider-->>Contract: Submit transaction
    Contract-->>Scanner: Transaction confirmed
    Scanner->>UI: Refresh data
```

## Export & Data Management Flow

```mermaid
graph TB
    A[Export Request] --> B{Export Type}
    B -->|CSV| C[CSV Formatter]
    B -->|JSON| D[JSON Formatter]
    B -->|Filtered| E[Apply Current Filters]
    B -->|All Data| F[Fetch All Records]
    
    E --> G[Get Filtered Dataset]
    F --> H[Get Complete Dataset]
    
    G --> I[Data Processor]
    H --> I
    
    C --> I
    D --> I
    
    I --> J[Format Conversion]
    J --> K[File Generation]
    K --> L[Download Trigger]
    
    subgraph "Data Sources"
        M[Tabulator Table Data]
        N[Database Raw Data]
        O[Calculated Fields]
    end
    
    G --> M
    H --> N
    I --> O
    
    subgraph "Format Options"
        P[Readable Dates]
        Q[Raw Timestamps]
        R[Calculated Estimates]
        S[Status Translations]
    end
    
    J --> P
    J --> Q
    J --> R
    J --> S
```

## Error Handling & Recovery System

```mermaid
graph TB
    A[Operation Start] --> B{Error Occurred?}
    B -->|No| C[Success Path]
    B -->|Yes| D[Error Classification]
    
    D --> E{Error Type}
    E -->|Network| F[Network Error Handler]
    E -->|API Rate Limit| G[Rate Limit Handler]
    E -->|Database| H[Database Error Handler]
    E -->|Wallet| I[Wallet Error Handler]
    E -->|RPC| J[RPC Error Handler]
    
    F --> K[Retry with Backoff]
    G --> L[Exponential Backoff]
    H --> M[Database Recovery]
    I --> N[Wallet Reconnection]
    J --> O[RPC Failover]
    
    K --> P{Retry Successful?}
    L --> P
    M --> P
    N --> P
    O --> P
    
    P -->|Yes| C
    P -->|No| Q[Graceful Degradation]
    
    Q --> R[User Notification]
    Q --> S[Partial Results]
    Q --> T[Offline Mode]
    
    subgraph "Recovery Strategies"
        U[Automatic Retry]
        V[User Intervention]
        W[Alternative Paths]
        X[Cache Fallback]
    end
    
    K --> U
    L --> U
    R --> V
    O --> W
    S --> X
```

## Progress Reporting & User Feedback

```mermaid
graph TB
    A[Operation Start] --> B[Progress Manager]
    B --> C[Progress UI Elements]
    B --> D[Toast Notifications]
    B --> E[Status Updates]
    
    C --> F[Progress Bar]
    C --> G[Progress Text]
    C --> H[ETA Calculator]
    
    D --> I[Success Toasts]
    D --> J[Error Toasts]
    D --> K[Warning Toasts]
    
    E --> L[Operation Stage]
    E --> M[Items Processed]
    E --> N[Rate Calculation]
    
    F --> O[Visual Progress]
    G --> P[Detailed Status]
    H --> Q[Time Estimates]
    
    subgraph "Scanner Progress"
        R[Address Progress]
        S[Token Progress]
        T[Detail Fetch Progress]
        U[Database Save Progress]
    end
    
    B --> R
    B --> S
    B --> T
    B --> U
    
    subgraph "User Feedback"
        V[Real-time Updates]
        W[Completion Notifications]
        X[Error Reporting]
        Y[Performance Metrics]
    end
    
    O --> V
    P --> V
    I --> W
    J --> X
    N --> Y
```

## Configuration & Settings Management

```mermaid
graph TB
    A[Settings Manager] --> B[Storage Layer]
    B --> C[LocalStorage]
    B --> D[IndexedDB Config]
    B --> E[Session Storage]
    
    A --> F[Configuration Categories]
    F --> G[Chain Settings]
    F --> H[User Preferences]
    F --> I[API Configuration]
    F --> J[Display Options]
    
    G --> K[Active Chain]
    G --> L[Custom RPCs]
    G --> M[Contract Addresses]
    
    H --> N[Theme Selection]
    H --> O[Tab Preferences]
    H --> P[Privacy Settings]
    
    I --> Q[API Keys]
    I --> R[Rate Limits]
    I --> S[Timeout Settings]
    
    J --> T[Table Columns]
    J --> U[Date Formats]
    J --> V[Number Formats]
    
    subgraph "Settings Persistence"
        W[Auto-save on Change]
        X[Validation on Load]
        Y[Migration on Update]
        Z[Backup on Export]
    end
    
    A --> W
    A --> X
    A --> Y
    A --> Z
    
    subgraph "Settings UI"
        AA[Settings Tab]
        BB[Modal Dialogs]
        CC[Inline Editors]
        DD[Quick Toggles]
    end
    
    F --> AA
    A --> BB
    A --> CC
    A --> DD
```

## Analytics & Performance Monitoring

```mermaid
graph TB
    A[Analytics Manager] --> B{Privacy Accepted?}
    B -->|Yes| C[Google Analytics]
    B -->|No| D[Local Analytics Only]
    
    C --> E[Page Views]
    C --> F[User Interactions]
    C --> G[Performance Metrics]
    
    D --> H[Local Performance Tracking]
    D --> I[Error Logging]
    
    A --> J[Performance Monitor]
    J --> K[Scan Duration Tracking]
    J --> L[API Response Times]
    J --> M[Database Operation Times]
    
    K --> N[Scanner Performance]
    L --> O[Network Performance]
    M --> P[Storage Performance]
    
    N --> Q[Optimization Insights]
    O --> Q
    P --> Q
    
    Q --> R[Performance Dashboard]
    Q --> S[Automated Optimizations]
    Q --> T[User Recommendations]
    
    subgraph "Metrics Collection"
        U[Scan Success Rates]
        V[Error Frequencies]
        W[Feature Usage]
        X[User Workflows]
    end
    
    J --> U
    I --> V
    F --> W
    F --> X
    
    subgraph "Privacy Controls"
        Y[Opt-in Analytics]
        Z[Local-only Mode]
        AA[Data Anonymization]
        BB[User Consent Management]
    end
    
    B --> Y
    D --> Z
    C --> AA
    A --> BB
```

This comprehensive flow diagram captures all major interactions, data flows, and system components in the WenXen.com application, from initialization through complex scanning operations to user interaction and error handling.