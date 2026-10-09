# Subnetting Practice Problems — Worked Solutions

CS-308 Computer Networks · Unit 2 · Tutorial Sheet

These problems practise the methods from the IP addressing lecture. Attempt each before reading the solution. All answers assume that the all-zeros (network) and all-ones (broadcast) host addresses are reserved.

## Quick Reference

| Prefix | Mask | Block size (in changing octet) | Addresses | Usable hosts |
|---|---|---|---|---|
| /24 | 255.255.255.0 | 256 (4th) | 256 | 254 |
| /25 | 255.255.255.128 | 128 (4th) | 128 | 126 |
| /26 | 255.255.255.192 | 64 (4th) | 64 | 62 |
| /27 | 255.255.255.224 | 32 (4th) | 32 | 30 |
| /28 | 255.255.255.240 | 16 (4th) | 16 | 14 |
| /29 | 255.255.255.248 | 8 (4th) | 8 | 6 |
| /30 | 255.255.255.252 | 4 (4th) | 4 | 2 |
| /20 | 255.255.240.0 | 16 (3rd) | 4096 | 4094 |
| /22 | 255.255.252.0 | 4 (3rd) | 1024 | 1022 |

General method for any address:

1. Find the octet where the mask stops being 255 (the "interesting" octet).
2. Block size = 256 − mask value in that octet.
3. Network address: round the interesting octet **down** to a multiple of the block size; set later octets to 0.
4. Broadcast address: network + block size − 1 in that octet; set later octets to 255.

## Problem 1: Network and broadcast for a /20 host

**Question.** A host has address 172.16.45.200/20. Find the subnet mask, network address, broadcast address, usable range and number of usable hosts.

**Solution.**

- /20 = 255.255.240.0. The interesting octet is the third; block size = 256 − 240 = 16.
- Multiples of 16 in the third octet: 0, 16, 32, 48, ... The value 45 lies in the block 32–47.
- Network address: **172.16.32.0**.
- Broadcast address: **172.16.47.255**.
- Usable hosts: **172.16.32.1 to 172.16.47.254**.
- Number of usable hosts: 2^12 − 2 = **4094**.

## Problem 2: Fixed-length subnetting

**Question.** An organisation owns 192.168.50.0/24 and needs at least 6 subnets of equal size. Give the new prefix, hosts per subnet, and the first three subnets.

**Solution.**

- Need 2^s >= 6, so s = 3 borrowed bits, giving 8 subnets. New prefix = 24 + 3 = **/27** (255.255.255.224).
- Host bits = 5, so 2^5 − 2 = **30 usable hosts** per subnet; block size 32.

| Subnet | Network | Usable range | Broadcast |
|---|---|---|---|
| 1 | 192.168.50.0/27 | .1 – .30 | .31 |
| 2 | 192.168.50.32/27 | .33 – .62 | .63 |
| 3 | 192.168.50.64/27 | .65 – .94 | .95 |

The eighth and last subnet is 192.168.50.224/27 (broadcast .255).

## Problem 3: Variable-Length Subnet Masking (VLSM)

**Question.** Allocate 192.168.100.0/24 to: LAN A with 100 hosts, LAN B with 50 hosts, LAN C with 20 hosts, and two point-to-point router links. Minimise waste.

**Solution.** Sort requirements from largest to smallest and allocate each from the next free aligned block.

| Segment | Hosts needed | Smallest prefix | Usable | Allocated block | Range (usable) |
|---|---|---|---|---|---|
| LAN A | 100 | /25 | 126 | 192.168.100.0/25 | .1 – .126 |
| LAN B | 50 | /26 | 62 | 192.168.100.128/26 | .129 – .190 |
| LAN C | 20 | /27 | 30 | 192.168.100.192/27 | .193 – .222 |
| Link 1 | 2 | /30 | 2 | 192.168.100.224/30 | .225 – .226 |
| Link 2 | 2 | /30 | 2 | 192.168.100.228/30 | .229 – .230 |

The range 192.168.100.232 – .255 remains free for future use (it could form a /29 at .232, a /29 at .240 and a /29 at .248).

Why sort first? Allocating small blocks first can leave the remaining space misaligned, so a large /25 no longer fits.

## Problem 4: Same subnet test

**Question.** Are 10.1.5.70/27 and 10.1.5.100/27 on the same subnet?

**Solution.** Block size for /27 is 32. The value 70 lies in 64–95, so its network is 10.1.5.64. The value 100 lies in 96–127, so its network is 10.1.5.96. The networks differ: **No**. Traffic between them must pass through a router.

A quick binary check: 70 = `010 00110`, 100 = `011 00100`. The first three bits of the last octet (the subnet bits) differ: 010 versus 011.

## Problem 5: Route summarisation

**Question.** A router has routes to 172.16.0.0/24, 172.16.1.0/24, 172.16.2.0/24 and 172.16.3.0/24. Give the single summary route.

**Solution.** Write the third octet in binary:

```
0 = 000000 00
1 = 000000 01
2 = 000000 10
3 = 000000 11
```

The first 6 bits of the third octet are common, so the summary prefix length is 16 + 6 = 22. Summary: **172.16.0.0/22** (mask 255.255.252.0). Summarisation works cleanly only when the number of networks is a power of two and the first network is aligned on that boundary.

## Problem 6: Choosing a mask from a host requirement

**Question.** What is the longest prefix (smallest subnet) that supports 500 hosts?

**Solution.** Need 2^h − 2 >= 500. 2^8 − 2 = 254 is too small; 2^9 − 2 = **510** is enough. So h = 9 host bits and the prefix is 32 − 9 = **/23** (255.255.254.0).

## Problem 7: Longest prefix match

**Question.** A forwarding table contains:

| Prefix | Next hop |
|---|---|
| 10.0.0.0/8 | R1 |
| 10.20.0.0/16 | R2 |
| 10.20.30.0/24 | R3 |
| 0.0.0.0/0 | R4 (default) |

Where are packets to 10.20.30.7, 10.20.99.1 and 11.1.1.1 sent?

**Solution.** 10.20.30.7 matches all of /8, /16 and /24; the longest is /24, so **R3**. 10.20.99.1 matches /8 and /16, so **R2**. 11.1.1.1 matches only the default route, so **R4**.

## Self-check Answers to Common Traps

- A /31 has no usable hosts under the classic rule, but RFC 3021 allows /31 on point-to-point links, giving 2 addresses with no broadcast.
- A /32 identifies a single host route.
- 192.168.10.64/26 is a valid network address; 192.168.10.70/26 is a host address, not a network address.
