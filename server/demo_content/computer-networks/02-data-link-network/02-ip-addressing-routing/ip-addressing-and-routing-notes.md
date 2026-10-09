# IP Addressing, Subnetting and Routing — Lecture Notes

CS-308 Computer Networks · Unit 2 · Data Link and Network Layers

## 1. The IPv4 Header

IPv4 (RFC 791) provides a connectionless, best-effort datagram service. The header is **20 bytes** without options and up to **60 bytes** with options.

| Field | Bits | Meaning |
|---|---|---|
| Version | 4 | 4 for IPv4 |
| IHL | 4 | Header length in 32-bit words (5 to 15) |
| DSCP / ECN | 6 / 2 | Quality-of-service class; congestion notification |
| Total Length | 16 | Header + data in bytes (max 65,535) |
| Identification | 16 | Identifies fragments of the same datagram |
| Flags | 3 | Reserved, DF (Don't Fragment), MF (More Fragments) |
| Fragment Offset | 13 | Position of the fragment in **8-byte units** |
| TTL | 8 | Decremented by each router; discarded at 0 (ICMP Time Exceeded) |
| Protocol | 8 | Upper-layer protocol: 1 ICMP, 6 TCP, 17 UDP, 89 OSPF |
| Header Checksum | 16 | Covers the header only; recomputed at every hop because TTL changes |
| Source / Destination Address | 32 each | IPv4 addresses |

**Fragmentation example**: a 4000-byte datagram (20-byte header + 3980 bytes data) crosses a link with MTU 1500. Each fragment may carry at most 1480 data bytes (a multiple of 8). Fragments carry 1480, 1480 and 1020 data bytes with offsets 0, 185 and 370 (1480 / 8 = 185); MF = 1, 1, 0. Reassembly happens only at the destination host.

## 2. IPv4 Addressing

An IPv4 address is 32 bits written in dotted decimal. It consists of a **network prefix** and a **host part**.

### Classful addressing (historical)

| Class | First octet | Leading bits | Default mask | Usable hosts per network |
|---|---|---|---|---|
| A | 1–126 | 0 | /8 (255.0.0.0) | 16,777,214 |
| B | 128–191 | 10 | /16 (255.255.0.0) | 65,534 |
| C | 192–223 | 110 | /24 (255.255.255.0) | 254 |
| D | 224–239 | 1110 | — | Multicast |
| E | 240–255 | 1111 | — | Reserved |

127.0.0.0/8 is reserved for loopback (127.0.0.1). Classful allocation wasted space: an organisation needing 2,000 addresses had to take a whole class B (65,534 hosts).

### CIDR

Classless Inter-Domain Routing (1993) allows a prefix of any length, written `a.b.c.d/n`. It enables efficient allocation and **route aggregation** (supernetting): routers forward using **longest prefix match**, choosing the most specific matching entry.

Special ranges: private addresses (RFC 1918) are 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16; 169.254.0.0/16 is link-local (APIPA); 255.255.255.255 is the limited broadcast.

### Subnetting formulas

For a prefix /n:

- Addresses per subnet = 2^(32 − n); usable hosts = 2^(32 − n) − 2 (network and broadcast addresses are reserved).
- Borrowing s bits from the host part creates 2^s subnets.
- **Block size** = 256 − (value of the mask in the octet where it changes).

### Worked example: 192.168.10.0/26

The network 192.168.10.0/24 is divided using a /26 mask (255.255.255.192). Two bits are borrowed, giving 2^2 = **4 subnets**, each with 2^6 = 64 addresses and **62 usable hosts**. Block size = 256 − 192 = 64.

| Subnet | Network address | First host | Last host | Broadcast |
|---|---|---|---|---|
| 1 | 192.168.10.0 | .1 | .62 | 192.168.10.63 |
| 2 | 192.168.10.64 | .65 | .126 | 192.168.10.127 |
| 3 | 192.168.10.128 | .129 | .190 | 192.168.10.191 |
| 4 | 192.168.10.192 | .193 | .254 | 192.168.10.255 |

Host 192.168.10.150 therefore belongs to subnet 192.168.10.128/26.

## 3. NAT

**Network Address Translation** lets many hosts with private addresses share one public address. The common form, **NAPT/PAT**, rewrites the source IP and source port of outgoing packets and records the mapping in a translation table:

```
Inside 192.168.1.10:51000  ->  Outside 203.0.113.5:62001
Inside 192.168.1.11:51000  ->  Outside 203.0.113.5:62002
```

The 16-bit port field allows roughly 60,000 simultaneous mappings per public address per protocol. NAT conserves IPv4 addresses but breaks the end-to-end principle: unsolicited inbound connections fail unless port forwarding or NAT traversal (STUN, TURN) is used.

## 4. IPv6 Basics

- Addresses are **128 bits**, written as eight groups of four hex digits. Leading zeros in a group may be dropped and one run of all-zero groups may be replaced by `::` (once per address). `2001:0db8:0000:0000:0000:0000:0000:0001` becomes `2001:db8::1`.
- Fixed **40-byte** base header; options move into **extension headers** chained by the Next Header field.
- No header checksum; **routers never fragment** (only the source does, after Path MTU Discovery); the minimum MTU is 1280 bytes.
- Hop Limit replaces TTL; a 20-bit Flow Label supports per-flow handling.
- Address types: unicast, multicast, anycast (no broadcast). `::1` is loopback, `fe80::/10` is link-local, `2000::/3` is global unicast.
- Hosts can configure themselves with **SLAAC** using Router Advertisements; ARP is replaced by **Neighbor Discovery** (ICMPv6).
- Transition: dual stack, tunnelling (6in4) and translation (NAT64).

## 5. Routing Algorithms

### Distance vector (Bellman-Ford)

Each router keeps a vector of its best known cost to every destination and periodically shares it **with neighbours only**. Updates use the Bellman-Ford equation:

```
D_x(y) = min over neighbours v of { c(x, v) + D_v(y) }
```

Good news propagates quickly; bad news propagates slowly. In the **count-to-infinity** problem, when link B–C fails, A and B keep advertising stale routes to each other and the cost to C climbs 1 at a time until it reaches the "infinity" value. Mitigations: **split horizon** (do not advertise a route back to the neighbour it was learned from), **poison reverse** (advertise it back with infinite cost), triggered updates and hold-down timers. These fix two-node loops but not all larger loops.

### Link state (Dijkstra)

Each router floods **link-state advertisements** describing its directly connected links to every router in the area. Every router then holds the full topology and runs **Dijkstra's shortest-path algorithm**, which costs O(n^2) with a simple array or O((n + E) log n) with a heap. Link-state converges faster and does not suffer count-to-infinity, but needs more memory and CPU.

### RIP, OSPF and BGP compared

| Property | RIP (v2) | OSPF (v2) | BGP-4 |
|---|---|---|---|
| Scope | Intra-domain (IGP) | Intra-domain (IGP) | Inter-domain (EGP) between ASes |
| Algorithm | Distance vector | Link state (Dijkstra) | Path vector |
| Metric | Hop count; 16 = infinity (max 15 hops) | Cost = reference bandwidth / link bandwidth (default reference 100 Mbps) | Policy and path attributes (AS-PATH, LOCAL_PREF, MED) |
| Transport | UDP port 520 | IP protocol 89 | TCP port 179 |
| Updates | Full table every 30 s | LSAs on change; hello every 10 s on broadcast links | Incremental after session setup |
| Hierarchy | Flat | Areas around backbone area 0 | Autonomous systems; eBGP and iBGP |
| Convergence | Slow | Fast | Policy-driven, can be slow |

BGP is a **path-vector** protocol: advertisements carry the full list of ASes on the path, so a router rejects any route containing its own AS number, which prevents loops.

## 6. Common Mistakes

- Forgetting to subtract 2 when counting usable hosts.
- Using classful boundaries when a CIDR prefix is given.
- Stating that IPv6 routers fragment packets.
- Thinking OSPF runs over TCP or UDP; it runs directly over IP.
