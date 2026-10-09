# Medium Access Control, Ethernet and Switching

CS-308 Computer Networks · Unit 2 · Data Link and Network Layers

## 1. The Multiple Access Problem

When several stations share one broadcast channel (a shared bus, a radio frequency), two simultaneous transmissions **collide** and both are corrupted. Medium Access Control (MAC) protocols decide who may transmit and when. They fall into three families:

- **Channel partitioning**: TDMA, FDMA, CDMA. No collisions, but idle slots are wasted under light load.
- **Random access**: ALOHA, CSMA, CSMA/CD, CSMA/CA. Stations transmit at will and recover from collisions.
- **Taking turns**: polling (a master invites each station) and token passing (a token circulates; only its holder transmits).

## 2. ALOHA

- **Pure ALOHA**: transmit whenever a frame is ready. A frame is vulnerable to collision for 2 frame times. Maximum throughput is `S = G e^(−2G)`, peaking at **1/(2e) ≈ 18.4%** when G = 0.5.
- **Slotted ALOHA**: time is divided into slots and frames start only at slot boundaries, halving the vulnerable period. `S = G e^(−G)`, maximum **1/e ≈ 36.8%** at G = 1.

Here G is the offered load in frames per frame time.

## 3. Carrier Sense Multiple Access (CSMA)

CSMA adds "listen before talk": a station senses the channel and transmits only if it is idle. Collisions still occur because of propagation delay: station B may sense the channel idle before A's signal has reached it.

Persistence strategies when the channel is busy:

- **1-persistent**: keep sensing and transmit immediately when idle (classic Ethernet). High collision probability when several stations are waiting.
- **Non-persistent**: wait a random time, then sense again. Fewer collisions, more idle time.
- **p-persistent** (slotted channels): when idle, transmit with probability p, otherwise defer one slot.

## 4. CSMA/CD versus CSMA/CA

### CSMA/CD (Collision Detection) — classic wired Ethernet

1. Sense the channel; when idle, start transmitting.
2. While transmitting, monitor the line. If a collision is detected, stop and send a 48-bit **jam signal**.
3. Apply **binary exponential backoff**: after the n-th collision, choose K uniformly from {0, 1, ..., 2^min(n,10) − 1} and wait K × 512 bit times. After 16 failed attempts the frame is discarded.

For collision detection to work, a frame must still be in transmission when news of a collision returns, so `T_trans >= 2 × T_prop`. This is why 10 Mbps Ethernet has a **minimum frame size of 64 bytes (512 bits)**, which is the **slot time** of 51.2 µs.

### CSMA/CA (Collision Avoidance) — IEEE 802.11 Wi-Fi

A wireless station cannot reliably detect collisions while transmitting (its own signal swamps the receiver) and suffers from the **hidden terminal problem**: A and C both reach access point B but cannot hear each other. 802.11 therefore avoids collisions instead of detecting them:

1. If the channel is idle for a **DIFS** interval, transmit; otherwise choose a random backoff counter and count down only while the channel is idle.
2. The receiver waits a shorter **SIFS** interval and returns an **ACK**. No ACK means the frame is assumed lost; the backoff range doubles.
3. Optional **RTS/CTS**: the sender reserves the channel with a short Request-To-Send; the receiver answers Clear-To-Send, which hidden stations also hear. Stations set their **NAV** (Network Allocation Vector) timer from the duration field and stay silent.

| Feature | CSMA/CD | CSMA/CA |
|---|---|---|
| Medium | Wired shared Ethernet (half duplex) | Wireless (802.11) |
| Collision handling | Detect, abort, jam, back off | Avoid with backoff, IFS and optional RTS/CTS |
| Acknowledgement | None at MAC layer | Link-layer ACK for every unicast frame |
| Hidden terminals | Not an issue | Mitigated by RTS/CTS |
| Modern relevance | Unused on full-duplex switched links | Used by all Wi-Fi generations |

## 5. Ethernet (IEEE 802.3)

### MAC addresses

A MAC address is **48 bits**, written as six hex pairs (for example, `3C:52:82:1A:9F:04`). The first 24 bits are the **OUI** assigned to the manufacturer. `FF:FF:FF:FF:FF:FF` is the broadcast address. The least significant bit of the first byte is 1 for multicast addresses.

### Ethernet II frame format

| Field | Size (bytes) | Purpose |
|---|---|---|
| Preamble | 7 | Alternating 1010... for clock synchronisation |
| Start Frame Delimiter | 1 | `10101011` marks the frame start |
| Destination MAC | 6 | Receiver address |
| Source MAC | 6 | Sender address |
| EtherType / Length | 2 | Values >= 0x0600 are EtherType (0x0800 IPv4); <= 1500 are length |
| Payload | 46–1500 | Padded to 46 bytes if shorter |
| FCS | 4 | CRC-32 over addresses, type and payload |

Counting from destination MAC to FCS, the frame is between **64 and 1518 bytes** (1522 with an 802.1Q VLAN tag). The 1500-byte payload limit is the Ethernet **MTU**. Consecutive frames are separated by a 96-bit-time **inter-frame gap**.

### Ethernet generations

10BASE-T (10 Mbps), 100BASE-TX Fast Ethernet, 1000BASE-T Gigabit Ethernet over Cat 5e, 10GBASE-T over Cat 6a, and 40/100 Gbps over fibre in data centres. Modern switched Ethernet is full duplex, so CSMA/CD is disabled.

## 6. Hubs, Switches and MAC Learning

- A **hub** (layer 1) repeats every incoming bit to all other ports: one collision domain and one broadcast domain.
- A **switch** (layer 2) forwards frames selectively. **Each port is its own collision domain**; all ports in the same VLAN form one broadcast domain.
- A **router** (layer 3) separates broadcast domains.

### Self-learning algorithm

A switch builds its **MAC address table** (CAM table) automatically:

```
on frame F arriving at port P:
    table[F.src] = (P, now)                  # learn / refresh
    if F.dst is broadcast or F.dst not in table:
        flood F to all ports except P
    else if table[F.dst].port == P:
        discard F                            # filter: same segment
    else:
        forward F to table[F.dst].port
entries older than the aging time (typically 300 s) are removed
```

Example: A (port 1) sends to D, whose location is unknown. The switch learns A → port 1 and floods. When D (port 4) replies, the switch learns D → port 4 and forwards the reply only to port 1.

Redundant links between switches create broadcast storms, so switches run the **Spanning Tree Protocol** (IEEE 802.1D) to block redundant ports and form a loop-free tree.

### ARP

Hosts map IPv4 addresses to MAC addresses with the **Address Resolution Protocol**: a broadcast ARP request ("who has 192.168.1.20?") is answered by a unicast ARP reply, and the mapping is cached for a limited time (often minutes).

## 7. Key Numbers to Remember

- Slot time (10/100 Mbps Ethernet): 512 bit times.
- Backoff cap: K up to 1023 after 10 collisions; abort after 16 attempts.
- Minimum / maximum frame: 64 / 1518 bytes; payload 46–1500 bytes.
- Pure / slotted ALOHA maximum throughput: 18.4% / 36.8%.
