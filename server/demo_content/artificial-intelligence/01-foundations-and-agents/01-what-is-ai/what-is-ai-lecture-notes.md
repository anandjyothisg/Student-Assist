# What is AI? History and Approaches

## 1. Defining Artificial Intelligence

There is no single accepted definition of artificial intelligence. Textbook definitions (notably Russell and Norvig, *Artificial Intelligence: A Modern Approach*) can be organised along two dimensions:

- **Thinking vs. acting**: is the goal to reproduce internal thought processes, or external behaviour?
- **Human vs. rational**: is success measured by fidelity to human performance, or against an ideal standard of correctness called *rationality*?

Crossing these dimensions gives the four classical approaches.

| | Human-like | Rational |
|---|---|---|
| **Thinking** | Thinking humanly: the cognitive modelling approach | Thinking rationally: the "laws of thought" (logicist) approach |
| **Acting** | Acting humanly: the Turing test approach | Acting rationally: the rational agent approach |

### 1.1 Thinking humanly (cognitive modelling)

To claim a program thinks like a human, we must know how humans think. Evidence comes from introspection, psychological experiments and brain imaging. Newell and Simon's General Problem Solver (GPS, 1959) was evaluated not only on whether it solved problems but on whether its reasoning trace resembled that of human subjects. This approach belongs to **cognitive science**, which combines computational models with experimental psychology.

### 1.2 Thinking rationally (laws of thought)

Aristotle's syllogisms ("Socrates is a man; all men are mortal; therefore Socrates is mortal") were early attempts to codify irrefutable reasoning. The **logicist** tradition aims to build systems that reason correctly in formal logic. Two difficulties limit it: informal knowledge is hard to state in logical notation, especially when it is uncertain, and solving a problem "in principle" differs greatly from solving it with finite computational resources.

### 1.3 Acting humanly (the Turing test)

Alan Turing's 1950 paper *Computing Machinery and Intelligence* proposed the **imitation game**: a human interrogator exchanges typed messages with a hidden human and a hidden machine; the machine passes if the interrogator cannot reliably tell which is which. Passing requires four capabilities:

- **Natural language processing** to communicate.
- **Knowledge representation** to store what it knows or hears.
- **Automated reasoning** to answer questions and draw conclusions.
- **Machine learning** to adapt and detect patterns.

The **total Turing test** adds a video signal and the ability to pass objects, requiring **computer vision** and **robotics**. Criticisms include Searle's **Chinese Room argument** (1980), which claims that symbol manipulation alone does not constitute understanding, and the practical observation that AI researchers rarely aim to pass the test: aeronautical engineers do not define flight as "flying so like a pigeon that other pigeons are fooled".

### 1.4 Acting rationally (the rational agent)

An **agent** is anything that perceives and acts. A **rational agent** acts to achieve the best expected outcome given its percepts and knowledge. This is the approach adopted in this course, for two reasons:

1. It is more general than the laws-of-thought approach: correct inference is only one mechanism for acting rationally (a reflex such as pulling a hand from a hot stove can be rational without deliberation).
2. Rationality is mathematically well defined, so agent designs can be analysed and proved to meet their goals, whereas "human-like" behaviour is a moving target.

**Perfect rationality** is usually computationally infeasible in complex environments. **Limited (bounded) rationality** means acting appropriately when there is not enough time to do all the computation one might like.

## 2. Foundational Disciplines

- **Philosophy**: logic, the mind as a physical system, rationality.
- **Mathematics**: formal logic, computability (Turing machines), tractability and NP-completeness, probability.
- **Economics**: utility, decision theory, game theory (von Neumann and Morgenstern, 1944).
- **Neuroscience**: the brain contains roughly 86 billion neurons.
- **Psychology**: behaviourism, cognitive psychology.
- **Computer engineering**: the hardware that makes AI possible.
- **Control theory and cybernetics**: feedback systems that minimise an objective function over time.
- **Linguistics**: Chomsky's work on syntactic structures (1957).

## 3. A Timeline of AI

### 3.1 Gestation and birth (1943–1956)

- **1943**: McCulloch and Pitts propose a model of artificial neurons that can compute any computable function.
- **1949**: Hebb proposes the Hebbian learning rule for modifying connection strengths.
- **1950**: Turing publishes *Computing Machinery and Intelligence*.
- **1951**: Minsky and Edmonds build SNARC, the first neural network computer (40 neurons).
- **1956**: The **Dartmouth Summer Research Project on Artificial Intelligence**, organised by John McCarthy, Marvin Minsky, Nathaniel Rochester and Claude Shannon. The term "artificial intelligence" was coined by McCarthy in the 1955 proposal for this workshop. Newell and Simon presented the **Logic Theorist**, which proved theorems from *Principia Mathematica*.

### 3.2 Early enthusiasm (1956–1969)

- GPS (Newell and Simon) imitated human problem-solving protocols.
- **1958**: McCarthy defines the **Lisp** programming language; Rosenblatt introduces the **perceptron**.
- **1959**: Samuel's checkers program learns to play better than its creator.
- Microworlds such as the blocks world (SHRDLU, Winograd, 1972) showed promising language understanding in tiny domains.

### 3.3 A dose of reality and the first AI winter (1966–1980)

- **1966**: The ALPAC report criticises machine translation and US funding is cut.
- **1969**: Minsky and Papert's *Perceptrons* shows single-layer perceptrons cannot represent functions such as XOR, slowing neural network research.
- **1973**: The **Lighthill report** in the UK concludes AI had failed to deliver; funding is withdrawn. The period of reduced funding from roughly **1974 to 1980** is called the **first AI winter**. The core problem was **combinatorial explosion**: methods that worked on toy problems did not scale.

### 3.4 Knowledge-based systems and the second winter (1969–1993)

- **Expert systems** encoded domain knowledge as rules. DENDRAL (1969) inferred molecular structure; **MYCIN** (mid-1970s) diagnosed blood infections using about 450 rules and certainty factors; **R1/XCON** configured computer orders at Digital Equipment Corporation, saving an estimated 40 million dollars per year by 1986.
- **1981**: Japan launches the Fifth Generation Computer project.
- **Second AI winter (about 1987–1993)**: the specialised Lisp-machine market collapsed in 1987, and expert systems proved brittle and expensive to maintain.

### 3.5 Return of neural networks and probabilistic reasoning (1986–2010)

- **1986**: Rumelhart, Hinton and Williams popularise **back-propagation** for training multilayer networks.
- **1988**: Pearl's *Probabilistic Reasoning in Intelligent Systems* establishes Bayesian networks; AI adopts probability and statistics in place of ad hoc certainty factors.
- **1997**: IBM's **Deep Blue** defeats world chess champion Garry Kasparov.
- **2011**: IBM Watson wins the quiz show *Jeopardy!*.

### 3.6 Big data and deep learning (2011–present)

- **2012**: **AlexNet** wins the ImageNet challenge with a top-5 error of about 15.3%, versus about 26% for the runner-up, triggering the deep learning era.
- **2016**: DeepMind's **AlphaGo** defeats Lee Sedol 4–1 at Go.
- **2017**: The **Transformer** architecture ("Attention Is All You Need") is introduced and becomes the basis of large language models.

## 4. Common Exam Pitfalls

- Do not equate "AI" with "passing the Turing test"; the Turing test is only the acting-humanly approach.
- "Rational" does not mean "omniscient" or "always successful"; it means maximising *expected* performance given available information.
- McCarthy coined the term in **1955** (the proposal); the workshop took place in **1956**.
- Minsky and Papert's critique applied to **single-layer** perceptrons, not to multilayer networks.
