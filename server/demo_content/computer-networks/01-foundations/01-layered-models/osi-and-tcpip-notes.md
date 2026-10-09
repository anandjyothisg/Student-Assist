# OSI and TCP/IP Models — Lecture Notes

CS-308 Computer Networks · Unit 1 · Network Foundations

## 1. Why Layering?

A network protocol stack is divided into layers so that each layer offers a well-defined **service** to the layer above it while hiding how that service is implemented. Layering gives three practical benefits:

- **Modularity**: a layer's implementation can change (for example, replacing copper Ethernet with Wi-Fi) without changing the layers above it, as long as the service interface stays the same.
- **Separation of concerns**: routing decisions belong to the network layer; reliable delivery belongs to the transport layer.
- **Interoperability**: vendors can build products for a single layer that work with products from other vendors.

Three terms recur throughout the course:

- **Service**: what a layer provides to the layer above (vertical relationship).
- **Protocol**: the rules that peer entities at the *same* layer on different machines use to communicate (horizontal relationship).
- **Interface**: the boundary through which a layer accesses the service of the layer below, via Service Access Points (SAPs).

A known drawback of strict layering is duplication of function (for example, error checking at both the data link and transport layers) and the temptation to violate layering for performance (cross-layer optimisation).

## 2. The OSI Reference Model

The Open Systems Interconnection (OSI) model was published by ISO as standard ISO/IEC 7498 in 1984. It has **seven layers**. A common mnemonic from layer 1 upward is "Please Do Not Throw Sausage Pizza Away".

| No. | Layer | Main functions | PDU name | Typical examples / devices |
|---|---|---|---|---|
| 7 | Application | Network services to user applications | Data / message | HTTP, SMTP, DNS, FTP |
| 6 | Presentation | Data representation, encoding, compression, encryption | Data | TLS (partially), MIME, ASN.1 |
| 5 | Session | Dialogue control, synchronisation checkpoints, session recovery | Data | RPC session setup, NetBIOS |
| 4 | Transport | End-to-end (process-to-process) delivery, segmentation, reliability, flow control | Segment (TCP) / datagram (UDP) | TCP, UDP |
| 3 | Network | Logical addressing, routing, forwarding across networks | Packet | IP, ICMP, OSPF; router |
| 2 | Data link | Framing, physical (MAC) addressing, error detection, medium access | Frame | Ethernet, 802.11, PPP; switch, bridge |
| 1 | Physical | Transmission of raw bits; voltages, timing, connectors | Bit | RJ-45, fibre; hub, repeater |

Points that are frequently examined:

- Only layers 1–3 are implemented in routers; end hosts implement all layers. Switches operate at layer 2, hubs and repeaters at layer 1.
- The transport layer is the first truly **end-to-end** layer: its peer is the transport entity on the destination host, not on an intermediate router.
- The data link layer provides **hop-to-hop** (node-to-node) delivery; the network layer provides **host-to-host** delivery; the transport layer provides **process-to-process** delivery using port numbers.
- Layer 2 is often split into the **LLC** (Logical Link Control, IEEE 802.2) and **MAC** (Medium Access Control) sublayers.

## 3. The TCP/IP Model

The TCP/IP (Internet) model predates OSI in practice and was derived from the protocols actually deployed on the ARPANET. The original RFC 1122 description uses **four layers**; many textbooks (Kurose and Ross, Forouzan) use a **five-layer** hybrid that separates the physical and data link layers.

| OSI layer(s) | TCP/IP 4-layer (RFC 1122) | 5-layer hybrid model |
|---|---|---|
| Application, Presentation, Session (7–5) | Application | Application |
| Transport (4) | Transport | Transport |
| Network (3) | Internet | Network |
| Data link (2) | Link (network access) | Data link |
| Physical (1) | Link (network access) | Physical |

### Key differences between OSI and TCP/IP

- **Origin**: OSI was specified first, then implemented; TCP/IP protocols existed first and the model describes them.
- **Session and presentation**: TCP/IP has no separate layers; these functions are absorbed into applications (for example, TLS handles encryption, HTTP handles content encoding).
- **Connection modes at the network layer**: OSI supports both connection-oriented and connectionless network service; TCP/IP's Internet layer is connectionless only (IP is a best-effort datagram service).
- **Transport layer**: TCP/IP supports both connection-oriented (TCP) and connectionless (UDP) transport.
- **Practical status**: TCP/IP is the deployed standard; OSI is mainly used as a teaching and vocabulary reference ("a layer-7 load balancer", "a layer-3 switch").

## 4. Encapsulation and Decapsulation

As data moves **down** the stack on the sender, each layer adds its own header (and the data link layer usually also adds a trailer). The data handed down from the layer above is called the **SDU** (Service Data Unit) of the lower layer; SDU plus header becomes that layer's **PDU** (Protocol Data Unit).

```
Application:                           [ HTTP message ]
Transport:                  [TCP hdr | HTTP message ]                 -> segment
Network:           [IP hdr | TCP hdr | HTTP message ]                 -> packet
Data link: [Eth hdr | IP hdr | TCP hdr | HTTP message | FCS]          -> frame
Physical:  0101100111010... (bits on the medium)
```

On the receiver, **decapsulation** proceeds upward: each layer strips its header, uses the header fields to process the PDU, and passes the payload to the correct upper-layer protocol using a **demultiplexing key**:

- Ethernet uses the 16-bit **EtherType** field (0x0800 = IPv4, 0x86DD = IPv6, 0x0806 = ARP).
- IPv4 uses the 8-bit **Protocol** field (1 = ICMP, 6 = TCP, 17 = UDP).
- TCP and UDP use the 16-bit **destination port** (80 = HTTP, 443 = HTTPS, 53 = DNS).

Routers perform decapsulation only up to layer 3: they remove the incoming frame header, inspect the IP header, decrement TTL, and re-encapsulate the packet in a new frame for the outgoing link. The IP addresses stay the same end to end (ignoring NAT), but the MAC addresses change on every hop.

### Worked example: header overhead

An application sends 1460 bytes of data in one TCP segment over Ethernet with no options.

- TCP header: 20 bytes; IPv4 header: 20 bytes; Ethernet header 14 bytes + FCS 4 bytes = 18 bytes.
- Frame size = 1460 + 20 + 20 + 18 = **1518 bytes**, the maximum standard Ethernet frame.
- On the wire, Ethernet also sends an 8-byte preamble/SFD and a 12-byte inter-frame gap, so each frame occupies 1538 byte-times.
- Efficiency = 1460 / 1538 ≈ **94.9%** of the raw link rate is available to application data.

The 1460-byte figure is the common TCP **MSS** (Maximum Segment Size) on Ethernet: MTU 1500 − 20 (IP) − 20 (TCP).

## 5. Common Pitfalls

- Confusing *protocol* (peer-to-peer rules) with *service* (what a layer offers upward).
- Saying routers "use port numbers": standard routing uses only layer-3 information; port inspection is done by firewalls and NAT devices.
- Writing that the TCP/IP model has seven layers. It has four (or five in the hybrid teaching model).
- Placing TLS cleanly at a single OSI layer: it sits between the application and TCP, performing presentation-layer functions; exam answers should explain this rather than force a single number.

## 6. Review Questions

1. Name the PDU at layers 2, 3 and 4 and the address type used at each.
2. Which OSI layers have no separate counterpart in the TCP/IP model, and where do their functions go?
3. A packet passes through three routers. How many times is the Ethernet header replaced? (Answer: the frame is rebuilt on each of the 4 links, so a new header is created 4 times including the source host.)
4. Calculate the efficiency if the TCP payload in the example above is only 100 bytes and the frame is padded to the 64-byte minimum where necessary.
