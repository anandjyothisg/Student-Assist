# Framing, Error Detection and Reliable Delivery — Lecture Notes

CS-308 Computer Networks · Unit 2 · Data Link and Network Layers

## 1. Framing

The physical layer delivers a raw bit stream. The data link layer must break this stream into **frames** so that the receiver can find where each frame starts and ends. Four methods are standard.

1. **Byte (character) count**: a header field gives the number of bytes in the frame. Simple, but a single corrupted count field causes the receiver to lose synchronisation for every following frame.
2. **Flag bytes with byte stuffing**: each frame begins and ends with a special FLAG byte (0x7E in PPP). If FLAG or ESC appears in the data, the sender inserts an ESC byte (0x7D in PPP) before it; the receiver removes it.
3. **Flag bits with bit stuffing**: HDLC uses the flag pattern `01111110`. Whenever the sender sees **five consecutive 1s** in the data, it inserts a 0. The receiver deletes any 0 that follows five 1s. Example: data `01111110` is transmitted as `011111010`.
4. **Physical-layer coding violations**: uses code words that never appear in data (for example, reserved symbols in 4B/5B encoding).

## 2. Error Detection and Correction

### Single parity bit

One extra bit makes the number of 1s even (even parity) or odd (odd parity). A single parity bit detects **any odd number** of bit errors but misses every even number of errors. Two-dimensional parity (row and column parity) can detect all 1-, 2- and 3-bit errors and can **correct** a single-bit error by locating its row and column.

### Hamming distance

The **Hamming distance** between two code words is the number of bit positions in which they differ (for example, d(10110, 11100) = 2). The minimum distance d_min of a code determines its power:

- To **detect** up to s errors: `d_min >= s + 1`.
- To **correct** up to t errors: `d_min >= 2t + 1`.

A single parity bit gives d_min = 2 (detects 1 error). Hamming(7,4) has d_min = 3 (corrects 1 error, or detects 2).

### Hamming(7,4) worked example

Positions 1, 2 and 4 (powers of two) hold parity bits; positions 3, 5, 6, 7 hold data. Parity p1 covers positions 1, 3, 5, 7; p2 covers 2, 3, 6, 7; p4 covers 4, 5, 6, 7 (even parity).

- Data `1011` placed at positions 3, 5, 6, 7 = 1, 0, 1, 1.
- p1 = 1 ⊕ 0 ⊕ 1 = 0; p2 = 1 ⊕ 1 ⊕ 1 = 1; p4 = 0 ⊕ 1 ⊕ 1 = 0.
- Code word (positions 1–7): **0110011**.
- Suppose bit 6 flips: received `0110001`. Recomputing checks: c1 = 0, c2 = 1, c4 = 1. The syndrome c4c2c1 = `110` = **6**, so the receiver flips bit 6 and recovers the data.

For m data bits, the number of check bits r must satisfy `2^r >= m + r + 1`.

### Cyclic Redundancy Check (CRC)

CRC treats bit strings as polynomials over GF(2), where addition and subtraction are both XOR. Sender and receiver agree on a **generator polynomial G(x)** of degree r.

Procedure:

1. Append r zero bits to the message M.
2. Divide the result by G using modulo-2 (XOR) long division.
3. The r-bit remainder is the CRC; append it to M in place of the zeros.
4. The receiver divides the whole received frame by G. A **zero remainder** means no detected error.

### CRC worked example

Message M = `1101011111`, generator G = `10011` (x^4 + x + 1, so r = 4).

```
Dividend: 1101011111 0000
11010 XOR 10011 = 01001
 10011 XOR 10011 = 00000        (bring down bits)
     11110 XOR 10011 = 01101
      11010 XOR 10011 = 01001
       10010 XOR 10011 = 00001
Remainder (last 4 bits) = 0010
```

Transmitted frame: **11010111110010**. Dividing this frame by 10011 yields remainder 0000.

Properties of a CRC with r check bits: it detects all single-bit errors, all double-bit errors (for a suitable G), every odd number of errors if (x + 1) is a factor of G, and **all burst errors of length <= r**. Ethernet uses **CRC-32** in its 4-byte Frame Check Sequence.

### Internet checksum

IP, TCP and UDP use a 16-bit **one's-complement sum** of the data, then take the one's complement of the result. It is cheap to compute in software but weaker than CRC; for example, it cannot detect reordered 16-bit words.

## 3. Flow and Error Control: ARQ Protocols

Automatic Repeat reQuest (ARQ) protocols combine error detection, acknowledgements (ACKs), timeouts and retransmission.

Define `a = T_prop / T_trans`, where T_trans is the time to transmit one frame.

### Stop-and-Wait

The sender transmits one frame and waits for its ACK before sending the next. A 1-bit sequence number (0, 1) distinguishes a new frame from a retransmitted duplicate.

```
Utilisation U = T_trans / (T_trans + 2 T_prop) = 1 / (1 + 2a)
```

Example: T_trans = 1 ms, T_prop = 10 ms gives a = 10 and U = 1/21 ≈ **4.8%**. Stop-and-wait wastes long or fast links.

### Sliding window

The sender may have up to W unacknowledged frames outstanding. If `W >= 1 + 2a`, the sender never stalls and U = 100% (error-free case); otherwise `U = W / (1 + 2a)`. In the example above, W = 21 frames would fill the pipe.

### Go-Back-N (GBN)

- Sender window up to `2^m − 1` with m-bit sequence numbers; receiver window = 1.
- The receiver accepts only the next in-order frame and discards out-of-order frames. ACKs are **cumulative**.
- On timeout for frame k, the sender retransmits frame k and **all** frames sent after it.
- Simple receiver, but wasteful on error-prone links.

### Selective Repeat (SR)

- Sender and receiver windows each up to `2^(m−1)` (half the sequence space).
- The receiver buffers out-of-order frames and individually ACKs each; the sender retransmits only frames that time out (or are NAKed).
- The window limit is necessary: with m = 2 (sequence numbers 0–3) and a window of 3, a lost batch of ACKs can make the receiver accept an old retransmitted frame 0 as a new frame 0.

| Protocol | Sender window | Receiver window | Retransmits | Receiver buffering |
|---|---|---|---|---|
| Stop-and-Wait | 1 | 1 | The single outstanding frame | None |
| Go-Back-N | <= 2^m − 1 | 1 | Lost frame and all later frames | None |
| Selective Repeat | <= 2^(m−1) | <= 2^(m−1) | Only lost frames | Out-of-order frames |

With m = 3 bits (sequence numbers 0–7): GBN allows a sender window of 7; SR allows windows of 4.

### Piggybacking

In full-duplex communication, an ACK can be carried inside a data frame travelling the other way, saving a separate control frame.

## 4. Exam Pitfalls

- CRC division uses XOR with **no borrows**; do not use ordinary binary subtraction.
- Remember to append r zeros (degree of G, which is one less than the number of bits in G).
- Correction needs a larger distance than detection: d_min = 3 corrects 1 error, not 2.
- GBN's receiver window is 1, not W.
