# TCP and UDP — Lecture Notes

CS-308 Computer Networks · Unit 3 · Transport and Application Layers

## 1. Role of the Transport Layer

The transport layer extends IP's host-to-host delivery to **process-to-process** delivery. It does this with **port numbers** (16 bits, 0–65535):

- **Well-known ports**: 0–1023 (22 SSH, 25 SMTP, 53 DNS, 80 HTTP, 443 HTTPS).
- **Registered ports**: 1024–49151 (3306 MySQL, 5432 PostgreSQL).
- **Dynamic / ephemeral ports**: 49152–65535, chosen by clients.

A UDP socket is identified by (destination IP, destination port). A TCP connection is identified by the **4-tuple** (source IP, source port, destination IP, destination port), which is how one web server on port 80 can hold thousands of simultaneous connections.

## 2. UDP

UDP (RFC 768) adds almost nothing to IP: multiplexing and an optional checksum. Its header is **8 bytes**:

| Field | Bits |
|---|---|
| Source port | 16 |
| Destination port | 16 |
| Length (header + data, minimum 8) | 16 |
| Checksum (optional in IPv4, mandatory in IPv6) | 16 |

UDP is connectionless, unreliable and unordered, with no flow or congestion control. It suits DNS queries, VoIP, video streaming, online games, DHCP and SNMP, and serves as the base for QUIC.

## 3. TCP Segment Structure

TCP (RFC 9293, formerly RFC 793) is connection-oriented, reliable, in-order and full duplex, and treats data as a **byte stream**. The header is **20–60 bytes**.

| Field | Bits | Notes |
|---|---|---|
| Source / destination port | 16 each | |
| Sequence number | 32 | Number of the **first byte** in this segment |
| Acknowledgement number | 32 | Next byte expected (cumulative ACK) |
| Data offset | 4 | Header length in 32-bit words |
| Flags | 8 | CWR, ECE, URG, ACK, PSH, RST, SYN, FIN |
| Receive window | 16 | Bytes the receiver can accept (rwnd) |
| Checksum | 16 | Covers header, data and a pseudo-header with IP addresses |
| Urgent pointer | 16 | Rarely used |
| Options | 0–320 | MSS, window scale, SACK permitted, timestamps |

Sequence numbers count **bytes**, not segments. If a segment carries bytes 1001–1500, its sequence number is 1001 and the receiver's ACK number is 1501.

## 4. Connection Establishment: Three-Way Handshake

```
Client                                 Server
  | --- SYN, seq = x ------------------> |   (client: SYN_SENT)
  | <-- SYN+ACK, seq = y, ack = x+1 ---- |   (server: SYN_RCVD)
  | --- ACK, seq = x+1, ack = y+1 -----> |   (both: ESTABLISHED)
```

- The initial sequence numbers x and y are chosen pseudo-randomly to avoid confusion with old segments and to resist spoofing.
- SYN and FIN each consume **one sequence number** even though they carry no data.
- The handshake costs **one RTT** before data can flow (the third segment may carry data).
- **SYN flooding** exploits half-open connections; **SYN cookies** defend against it by encoding state in the server's ISN.

## 5. Connection Termination: Four-Way Teardown

```
Client (active close)                  Server
  | --- FIN, seq = u ------------------> |   FIN_WAIT_1
  | <-- ACK, ack = u+1 ----------------- |   CLOSE_WAIT / FIN_WAIT_2
  | <-- FIN, seq = v ------------------- |   LAST_ACK
  | --- ACK, ack = v+1 ----------------> |   TIME_WAIT -> CLOSED
```

Each direction is closed independently (a **half-close** is possible). The active closer waits in **TIME_WAIT** for **2 × MSL** (Maximum Segment Lifetime, commonly 30 s to 2 min) so that its final ACK can be retransmitted if lost and so that delayed segments from the old connection die out. An **RST** aborts a connection immediately.

## 6. Reliability Mechanisms

- **Cumulative ACKs**; most receivers use **delayed ACKs** (up to 500 ms, typically one ACK per two segments).
- **Retransmission timer** based on measured RTT (RFC 6298):

```
EstimatedRTT = (1 - α) × EstimatedRTT + α × SampleRTT      α = 0.125
DevRTT       = (1 - β) × DevRTT + β × |SampleRTT - EstimatedRTT|   β = 0.25
RTO          = EstimatedRTT + 4 × DevRTT   (minimum 1 s per RFC 6298)
```

- On timeout, the RTO doubles (exponential backoff). Karn's algorithm ignores RTT samples from retransmitted segments.
- **Fast retransmit**: three duplicate ACKs trigger retransmission before the timer expires.
- **SACK** (selective acknowledgement) lets the receiver report non-contiguous blocks received.

## 7. Flow Control

Flow control protects the **receiver's buffer**. The receiver advertises `rwnd = RcvBuffer − (LastByteRcvd − LastByteRead)`, and the sender ensures `LastByteSent − LastByteAcked <= rwnd`. If rwnd reaches 0, the sender sends 1-byte **zero-window probes** so it learns when space opens.

The 16-bit window field limits rwnd to 65,535 bytes. The **window scale** option multiplies it by 2^S with S up to 14, giving windows up to about 1 GiB, which is necessary for paths with a large bandwidth-delay product.

## 8. Congestion Control

Congestion control protects the **network**. The sender keeps a congestion window **cwnd** and limits unacknowledged data to `min(cwnd, rwnd)`. Throughput is roughly `cwnd / RTT`.

- **Slow start**: cwnd starts at the initial window (1 MSS in classic analysis; RFC 6928 permits 10 MSS) and grows by 1 MSS per ACK, so it **doubles every RTT** (exponential growth) until it reaches **ssthresh**.
- **Congestion avoidance**: once cwnd >= ssthresh, cwnd grows by about **1 MSS per RTT** (additive increase).
- **On timeout**: `ssthresh = cwnd / 2`, `cwnd = 1 MSS`, re-enter slow start.
- **On three duplicate ACKs (TCP Reno)**: fast retransmit the missing segment; `ssthresh = cwnd / 2`; `cwnd = ssthresh + 3 MSS`; in **fast recovery**, inflate cwnd by 1 MSS per further duplicate ACK; when a new ACK arrives, set `cwnd = ssthresh` and continue in congestion avoidance.
- **TCP Tahoe** treats triple duplicate ACKs like a timeout (cwnd = 1).

This additive-increase, multiplicative-decrease (**AIMD**) behaviour produces the familiar sawtooth. Linux now defaults to **CUBIC**, and Google's **BBR** estimates bottleneck bandwidth and RTT instead of reacting to loss.

### Worked trace (Reno, units of MSS, initial ssthresh = 16)

| RTT round | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cwnd | 1 | 2 | 4 | 8 | 16 | 17 | 18 | 19 | 20 | 10 | 11 | 12 |

Rounds 1–5 are slow start. From round 6 the sender is in congestion avoidance. Triple duplicate ACKs occur at cwnd = 20, so ssthresh becomes 10 and cwnd restarts at 10 (shown after fast recovery completes). If a timeout then occurred at cwnd = 12, ssthresh would become 6 and cwnd would drop to 1.

## 9. TCP versus UDP

| Feature | TCP | UDP |
|---|---|---|
| Connection | Connection-oriented (handshake) | Connectionless |
| Reliability | ACKs, retransmission, checksums | Checksum only; no recovery |
| Ordering | In-order byte stream | No ordering; message boundaries preserved |
| Flow / congestion control | Yes / yes | No / no |
| Header size | 20–60 bytes | 8 bytes |
| Setup latency | 1 RTT before data | None |
| Typical uses | Web (HTTP/1.1, HTTP/2), email, SSH, file transfer | DNS, VoIP, streaming, games, DHCP, QUIC |

## 10. Pitfalls

- Flow control and congestion control are different: one is driven by rwnd (receiver), the other by cwnd (network).
- The ACK number is the **next expected byte**, not the last byte received.
- Slow start is not slow: cwnd grows exponentially.
