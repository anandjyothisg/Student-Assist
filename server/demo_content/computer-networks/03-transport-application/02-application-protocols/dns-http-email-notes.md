# Application Layer Protocols: DNS, HTTP, Email and TLS — Lecture Notes

CS-308 Computer Networks · Unit 3 · Transport and Application Layers

## 1. Domain Name System (DNS)

DNS maps human-readable names (`www.example.edu`) to IP addresses and other data. It is a **distributed, hierarchical database** and normally runs over **UDP port 53**. It switches to TCP port 53 for zone transfers and for responses too large for UDP.

### Hierarchy

- **Root servers**: 13 logical root server identities (`a.root-servers.net` to `m.root-servers.net`), served by over a thousand physical instances using anycast. They refer queries to TLD servers.
- **Top-level domain (TLD) servers**: generic TLDs (`.com`, `.org`, `.edu`) and country-code TLDs (`.in`, `.de`, `.uk`).
- **Authoritative servers**: hold the actual records for an organisation's zone (for example, `example.edu`).
- **Local (recursive) resolver**: run by the ISP, campus or a public service (8.8.8.8, 1.1.1.1). It is not strictly part of the hierarchy but does most of the work and caches results.

### Recursive and iterative resolution

- **Iterative query**: the server answers with the best information it has, usually a referral ("ask this TLD server"). The resolver then contacts the next server itself.
- **Recursive query**: the server takes responsibility for returning the final answer, querying others on the client's behalf.

In practice, the host sends a **recursive** query to its local resolver, and the resolver makes **iterative** queries: root → `.edu` TLD → `example.edu` authoritative. With an empty cache, resolving one name costs 3 round trips from the resolver, plus 1 from the host to the resolver.

**Caching**: every record carries a **TTL** (in seconds). Resolvers cache answers and referrals until the TTL expires, so TLD server addresses are rarely fetched from the root.

### Resource record types

Records have the form (Name, Value, Type, TTL).

| Type | Value | Example |
|---|---|---|
| A | IPv4 address | `www.example.edu A 93.184.216.34` |
| AAAA | IPv6 address | `www.example.edu AAAA 2001:db8::34` |
| CNAME | Canonical name for an alias | `cs.example.edu CNAME web1.example.edu` |
| MX | Mail server for a domain, with preference (lower = preferred) | `example.edu MX 10 mail.example.edu` |
| NS | Authoritative name server for a zone | `example.edu NS ns1.example.edu` |
| PTR | Reverse lookup (IP to name) | `34.216.184.93.in-addr.arpa PTR www.example.edu` |
| TXT | Free text (SPF, domain verification) | `"v=spf1 mx -all"` |
| SOA | Zone parameters (serial, refresh, expiry) | One per zone |

A CNAME cannot coexist with other record types at the same name, so it cannot be used at a zone apex.

## 2. HTTP

HTTP is a request-response, **stateless** protocol: the server keeps no memory of past requests. HTTP/1.1 and HTTP/2 run over TCP (port 80, or 443 with TLS).

### Request methods

| Method | Purpose | Safe | Idempotent |
|---|---|---|---|
| GET | Retrieve a resource | Yes | Yes |
| HEAD | As GET, headers only | Yes | Yes |
| POST | Submit data / create a subordinate resource | No | No |
| PUT | Create or replace a resource at a known URI | No | Yes |
| PATCH | Partially modify a resource | No | Not guaranteed |
| DELETE | Remove a resource | No | Yes |
| OPTIONS | Ask which methods are supported (CORS preflight) | Yes | Yes |

**Safe** means no change to server state; **idempotent** means repeating the request has the same effect as sending it once.

### Status codes

- **1xx informational**: 100 Continue, 101 Switching Protocols.
- **2xx success**: 200 OK, 201 Created, 204 No Content.
- **3xx redirection**: 301 Moved Permanently, 302 Found, 304 Not Modified (response to a conditional GET with `If-Modified-Since` or `If-None-Match`).
- **4xx client error**: 400 Bad Request, 401 Unauthorized (authentication needed), 403 Forbidden (authenticated but not permitted), 404 Not Found, 429 Too Many Requests.
- **5xx server error**: 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout.

### Persistent and non-persistent connections

- **Non-persistent** (HTTP/1.0 default): one TCP connection per object. Each object costs **2 RTT + transmission time** (one RTT for the TCP handshake, one for request and response).
- **Persistent** (HTTP/1.1 default, `Connection: keep-alive`): the connection is reused, so each later object costs about **1 RTT**.

Example: a page with a base HTML file and 10 images, RTT = 50 ms, negligible transmission time. Non-persistent and serial: 11 × 2 × 50 = **1100 ms**. Persistent without pipelining: 2 × 50 + 10 × 50 = **600 ms**.

### HTTP versions

| Feature | HTTP/1.1 (1997) | HTTP/2 (2015) | HTTP/3 (2022) |
|---|---|---|---|
| Transport | TCP | TCP | QUIC over UDP |
| Format | Text | Binary frames | Binary frames |
| Concurrency | One request at a time per connection; browsers open about 6 connections | Many multiplexed streams on one connection | Independent QUIC streams |
| Header compression | None | HPACK | QPACK |
| Head-of-line blocking | At HTTP level | Removed at HTTP level, remains at TCP level | Removed (loss affects only its stream) |
| Setup | TCP + TLS handshakes | TCP + TLS handshakes | Combined 1-RTT; 0-RTT on resumption |

### Cookies

Because HTTP is stateless, servers track sessions with cookies: the response header `Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax` makes the browser send `Cookie: sid=abc123` on later requests. `HttpOnly` hides the cookie from JavaScript, `Secure` restricts it to HTTPS, and `SameSite` limits cross-site sending to reduce CSRF attacks.

## 3. Electronic Mail

| Protocol | Role | Port (plain / TLS) | Notes |
|---|---|---|---|
| SMTP | Push mail: client to server and server to server | 25 (relay), 587 (submission), 465 (implicit TLS) | Uses commands HELO/EHLO, MAIL FROM, RCPT TO, DATA, QUIT |
| POP3 | Retrieve mail to one device | 110 / 995 | Typically download and delete; little server-side state |
| IMAP | Access mail kept on the server | 143 / 993 | Folders, flags and sync across many devices |

Delivery path: the sender's user agent submits to its mail server via SMTP; that server looks up the recipient domain's **MX record** and relays via SMTP; the recipient retrieves the message with IMAP or POP3. SMTP is a **push** protocol; POP3 and IMAP are **pull** protocols. MIME extends messages beyond 7-bit ASCII to carry attachments.

## 4. HTTPS and the TLS Handshake

HTTPS is HTTP over **TLS** on port 443. TLS provides confidentiality (symmetric encryption, such as AES-GCM), integrity (AEAD tags) and server authentication (X.509 certificates signed by a certificate authority).

TLS 1.3 handshake (one RTT):

1. **ClientHello**: supported cipher suites, a random nonce and a key share (an ephemeral Diffie-Hellman public value), plus the server name (SNI).
2. **ServerHello**: the chosen cipher suite and the server's key share. Both sides now derive the shared secret. The server continues with encrypted **Certificate**, **CertificateVerify** (a signature proving it owns the private key) and **Finished**.
3. The client validates the certificate chain and the hostname, sends **Finished**, and application data flows.

Ephemeral Diffie-Hellman provides **forward secrecy**: compromising the server's long-term key later does not decrypt recorded sessions. TLS 1.2 needed two round trips; TLS 1.3 needs one, and resumed sessions can send 0-RTT data (at some risk of replay).
