export const PRESETS = {
  flowchart: `flowchart TD
    Order([Place Order]) --> Payment{Payment OK?}
    Payment -->|Declined| Retry[Retry Payment]
    Retry --> Payment
    Payment -->|Approved| Stock{In Stock?}
    Stock -->|No| Backorder[Add to Backorder]
    Stock -->|Yes| Pack[Pack Items]
    Pack --> Ship[Ship Order]
    Ship --> Notify[Notify Customer]
    Notify --> Done([Order Complete])`,

  workflow: `flowchart TD
    Start([User Registration]) --> Input[Fill Details]
    Input --> Valid{Valid Input?}
    Valid -->|No| ShowError[Show Validation Error]
    ShowError --> Input
    Valid -->|Yes| CheckUser{User Exists?}
    CheckUser -->|Yes| Login[Prompt Login]
    CheckUser -->|No| Create[Create Account]
    Create --> Email[Send Verification Email]
    Email --> Success([Success])`,

  decision: `flowchart LR
    Start([Service Offline]) --> CheckPing{Ping Server?}
    CheckPing -->|Fail| Reboot[Reboot Server]
    CheckPing -->|Pass| CheckPort{Port 443 Open?}
    Reboot --> CheckPing
    CheckPort -->|No| StartService[Start Web Service]
    CheckPort -->|Yes| CheckDB{DB Reachable?}
    StartService --> CheckPort
    CheckDB -->|No| FixDB[Restore DB Connection]
    CheckDB -->|Yes| Online([Service Online])
    FixDB --> CheckDB`,

  devops: `flowchart TD
    User([User Client]) -->|HTTPS| DNS[Cloudflare DNS]
    DNS -->|Load Balance| ALB[Application Load Balancer]
    ALB -->|Route HTTP| WebApp[Web Application Server]
    WebApp -->|Read/Write| DB[(PostgreSQL Database)]
    DB -->|Replicate| DBReplica[(Read Replica)]
    WebApp -.->|Cache/Session| RedisServer((Redis Cache))`,

  sequence: `sequenceDiagram
    actor Alice as Alice
    actor Bob as Bob
    actor Charlie as Charlie
    Alice->>Bob: Can you ask Charlie for the file?
    Bob->>Charlie: Alice needs the file.
    Charlie-->>Bob: Here is the file.
    Bob-->>Alice: Delivered!`,

  sequence_auth: `sequenceDiagram
    actor User
    participant App as Client Application
    participant Auth as Auth Server
    User->>App: Click "Login with OAuth"
    App->>Auth: Redirect to Auth Page
    Auth->>User: Prompt for Credentials
    User->>Auth: Provide Credentials
    Auth-->>App: Authorization Code
    App->>Auth: Exchange Code for Access Token
    Auth-->>App: Access Token & ID Token
    App-->>User: Login Successful`,

  sequence_db: `sequenceDiagram
    actor Client
    participant API as API Gateway
    participant DB as Main Database
    participant Cache as Redis Cache
    Client->>API: GET /user/profile
    API->>Cache: Check user session
    Cache-->>API: Session Valid
    API->>DB: Query profile details (ID: 101)
    DB-->>API: User Data
    API->>Cache: Update profile cache
    API-->>Client: 200 OK (Profile JSON)`,
};

export type PresetKey = keyof typeof PRESETS;

