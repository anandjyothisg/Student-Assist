# Network Performance and the Physical Layer — Lecture Notes

CS-308 Computer Networks · Unit 1 · Network Foundations

## 1. Bandwidth and Throughput

- **Bandwidth** has two meanings. In signal terms it is the width of a frequency band, in hertz (Hz). In data terms it is the maximum bit rate a link can carry, in bits per second (bps).
- **Throughput** is the bit rate actually achieved between two endpoints, measured over a time interval. Throughput is always less than or equal to bandwidth.
- On a multi-link path, end-to-end throughput is limited by the **bottleneck link**: `throughput = min(R1, R2, ..., RN)`.

Example: a server connects at 1 Gbps, the core path runs at 10 Gbps, and the client's access link is 50 Mbps. Ignoring other traffic, the maximum throughput is 50 Mbps, so a 100 MB file (800 Mb) needs at least 800 / 50 = 16 s.

Units: networking uses decimal prefixes for rates (1 Mbps = 10^6 bps), and file sizes are given in bytes (multiply by 8 for bits).

## 2. The Four Components of Delay

The total delay a packet experiences at each node is:

```
d_nodal = d_proc + d_queue + d_trans + d_prop
```

| Component | Cause | Formula / typical value | Depends on |
|---|---|---|---|
| Processing (d_proc) | Header inspection, checksum, forwarding table lookup | microseconds | Router hardware |
| Queuing (d_queue) | Waiting in the output buffer behind other packets | 0 to milliseconds; varies packet to packet | Traffic intensity |
| Transmission (d_trans) | Pushing all bits of the packet onto the link | `L / R` | Packet length L, link rate R |
| Propagation (d_prop) | Signal travelling along the medium | `d / s` | Distance d, propagation speed s |

- Propagation speed s is about **2 × 10^8 m/s** in copper and fibre (roughly two-thirds of the speed of light) and about 3 × 10^8 m/s in free space.
- Transmission delay and propagation delay are independent: transmission delay does not depend on distance, and propagation delay does not depend on packet size or link rate.

### Traffic intensity

With average packet arrival rate a (packets/s), packet length L bits and link rate R bps, the **traffic intensity** is `La / R`. If `La / R > 1`, the queue grows without bound; as `La / R` approaches 1, average queuing delay grows sharply. Packets that arrive at a full buffer are dropped (packet loss).

### Worked example: total delay

A host sends a 1500-byte packet over one 10 Mbps link of length 2000 km. Propagation speed is 2 × 10^8 m/s, processing delay is 50 µs and queuing delay is 2 ms.

- L = 1500 × 8 = 12,000 bits.
- d_trans = 12,000 / (10 × 10^6) = **1.2 ms**.
- d_prop = (2 × 10^6 m) / (2 × 10^8 m/s) = **10 ms**.
- d_total = 0.05 + 2 + 1.2 + 10 = **13.25 ms**.

If the link rate rises to 1 Gbps, d_trans falls to 0.012 ms but d_prop stays 10 ms: on long links, propagation dominates.

### Store-and-forward

A router must receive the entire packet before forwarding it. With N links of equal rate R and no queuing, sending one packet of L bits costs `N × L / R` in transmission delay. Sending P packets back to back takes `(N + P − 1) × L / R`.

### Round-trip time (RTT)

RTT is the time for a small packet to travel to a destination and back. It includes propagation, processing and queuing delays in both directions. The `ping` utility reports RTT using ICMP Echo Request/Reply.

## 3. Bandwidth-Delay Product

The **bandwidth-delay product** (BDP) is the number of bits "in flight" that fill the link:

```
BDP = R × d_prop          (bits on the link one way)
BDP_RTT = R × RTT         (bits a sender must send before the first ACK can return)
```

Example: R = 100 Mbps, RTT = 20 ms. `BDP_RTT = 100 × 10^6 × 0.020 = 2,000,000 bits = 250 KB`. A sender that wants to keep this pipe full must be allowed to have 250 KB of unacknowledged data outstanding, which is why TCP's 16-bit window (maximum 65,535 bytes) needs the window-scale option on such paths.

## 4. Theoretical Channel Capacity

### Nyquist (noiseless channel)

For a noiseless channel of bandwidth B Hz using L discrete signal levels:

```
C = 2 × B × log2(L)   bps
```

Example: B = 3000 Hz, L = 4 levels. C = 2 × 3000 × log2(4) = 2 × 3000 × 2 = **12,000 bps**. Increasing L raises the rate in theory, but more levels are harder for the receiver to distinguish in the presence of noise.

### Shannon (noisy channel)

For a channel of bandwidth B Hz with signal-to-noise ratio SNR (as a plain ratio, not dB):

```
C = B × log2(1 + SNR)   bps
SNR_dB = 10 × log10(S / N)
```

Example: a telephone line with B = 3000 Hz and SNR = 30 dB. SNR = 10^(30/10) = 1000. C = 3000 × log2(1001) ≈ 3000 × 9.967 ≈ **29,900 bps** (about 30 kbps). No encoding scheme can exceed this limit with arbitrarily low error.

### Using both together

Shannon gives the upper bound; Nyquist tells you how many levels are needed to approach it. Example: B = 1 MHz, SNR = 63. Shannon: C = 10^6 × log2(64) = **6 Mbps**. Choose a practical rate below this, say 4 Mbps; Nyquist then gives 4 × 10^6 = 2 × 10^6 × log2(L), so log2(L) = 2 and **L = 4** levels.

A common pitfall is to plug the SNR in decibels directly into Shannon's formula. Always convert first.

## 5. Transmission Media

### Guided (wired) media

| Medium | Typical rate / distance | Notes |
|---|---|---|
| Twisted pair Cat 5e | 1 Gbps up to 100 m | Twisting reduces crosstalk and EMI |
| Twisted pair Cat 6 / 6a | 10 Gbps up to 55 m / 100 m | Common in modern office cabling |
| Coaxial cable | Hundreds of Mbps to Gbps (DOCSIS) | Shielded; used in cable TV and broadband |
| Multimode fibre | 10 Gbps over a few hundred metres | Larger core, LED/VCSEL source, modal dispersion |
| Single-mode fibre | 10–400 Gbps over tens of km | ~9 µm core, laser source, lowest attenuation |

Fibre is immune to electromagnetic interference, difficult to tap, and has very low attenuation (about 0.2 dB/km at 1550 nm), which is why it forms the Internet backbone.

### Unguided (wireless) media

- **Radio waves** (roughly 3 kHz–1 GHz): omnidirectional, penetrate walls; AM/FM radio, many cellular bands.
- **Microwaves** (1–300 GHz): directional, line-of-sight; Wi-Fi at 2.4/5/6 GHz, point-to-point links, satellites.
- **Infrared**: short range, blocked by walls; remote controls.

Satellites in **geostationary orbit** sit at about 35,786 km altitude, so a ground-satellite-ground path adds roughly 2 × 35,786 km / (3 × 10^5 km/s) ≈ **240 ms** of one-way propagation delay. Low-Earth-orbit constellations (around 550 km) reduce this to a few milliseconds.

## 6. Summary of Formulas

- Transmission delay: `L / R`
- Propagation delay: `d / s`
- Traffic intensity: `La / R` (keep below 1)
- Bandwidth-delay product: `R × RTT`
- Nyquist: `C = 2B log2(L)`; Shannon: `C = B log2(1 + SNR)`
