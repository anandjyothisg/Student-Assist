# Intelligent Agents and Environments

## 1. Agents, Percepts and Actions

An **agent** perceives its **environment** through **sensors** and acts upon it through **actuators**. A **percept** is the agent's sensory input at one instant; the **percept sequence** is the complete history of everything the agent has perceived.

- The **agent function** maps every possible percept sequence to an action. It is an abstract mathematical description.
- The **agent program** is a concrete implementation of the agent function that runs on a physical **architecture**.
- Hence: **agent = architecture + program**.

A table-driven agent that looks up the action for every percept sequence is infeasible: with |P| possible percepts and lifetime T, the table needs the sum over t = 1..T of |P|^t entries. The goal of AI is to produce rational behaviour from a compact program.

### 1.1 The vacuum-cleaner world

A standard toy example has two squares, A and B. Each may be Clean or Dirty. Percepts are `[location, status]`; actions are `Left`, `Right`, `Suck`. A simple agent function: if the current square is dirty, suck; otherwise move to the other square.

## 2. Rationality

A **rational agent** selects, for each possible percept sequence, an action that is expected to maximise its **performance measure**, given the evidence provided by the percept sequence and its built-in knowledge.

Rationality depends on four things: the performance measure, the agent's prior knowledge of the environment, the available actions, and the percept sequence to date.

- Rationality is **not omniscience**: a rational agent maximises expected, not actual, outcome.
- Rational agents perform **information gathering** (for example, looking before crossing a road) and **learning**.
- An agent that relies only on prior knowledge of its designer, rather than its own percepts, lacks **autonomy**.
- Performance measures should be designed according to what one wants in the environment, not according to how one thinks the agent should behave (rewarding a vacuum for "dirt sucked" invites it to dump and re-suck dirt).

## 3. Specifying the Task Environment: PEAS

A task environment is specified by **PEAS**: Performance measure, Environment, Actuators, Sensors.

| Agent | Performance measure | Environment | Actuators | Sensors |
|---|---|---|---|---|
| Automated taxi | Safe, fast, legal, comfortable trip; maximise profit | Roads, other traffic, pedestrians, customers, weather | Steering, accelerator, brake, signal, horn, display | Cameras, radar/lidar, speedometer, GPS, odometer, accelerometer, engine sensors |
| Medical diagnosis system | Healthy patient, reduced costs | Patient, hospital, staff | Display of questions, tests, diagnoses, treatments | Keyboard entry of symptoms, findings, patient answers |
| Part-picking robot | Percentage of parts in correct bins | Conveyor belt with parts, bins | Jointed arm and hand | Camera, joint angle sensors |
| English tutoring system | Student's score on test | Set of students, testing agency | Display of exercises, feedback | Keyboard entry |

## 4. Properties of Task Environments

1. **Fully vs. partially observable**: fully observable if sensors give access to the complete relevant state at each time. Noisy or missing sensors make an environment partially observable. If the agent has no sensors, it is **unobservable**.
2. **Single-agent vs. multi-agent**: multi-agent environments may be **competitive** (chess) or **cooperative** (avoiding collisions between taxis), or partly both.
3. **Deterministic vs. nondeterministic (stochastic)**: deterministic if the next state is completely determined by the current state and the action. "Stochastic" is used when outcomes are quantified with probabilities.
4. **Episodic vs. sequential**: in episodic environments, experience divides into atomic episodes, and the action in one episode does not affect later ones (classifying defective parts on an assembly line). In sequential environments, current decisions affect all future decisions.
5. **Static vs. dynamic**: dynamic if the environment can change while the agent deliberates. **Semidynamic** if the environment does not change but the performance score does (chess played with a clock).
6. **Discrete vs. continuous**: applies to states, time, percepts and actions.
7. **Known vs. unknown**: refers to the agent's knowledge of the "laws of physics" of the environment, not to observability. A known environment can be partially observable (solitaire card games); an unknown one can be fully observable (a new video game whose controls are unknown).

The hardest case is partially observable, multi-agent, nondeterministic, sequential, dynamic, continuous and unknown. Taxi driving is hard in all of these senses except that the environment is largely known.

| Task | Observable | Agents | Deterministic | Episodic | Static | Discrete |
|---|---|---|---|---|---|---|
| Crossword puzzle | Fully | Single | Deterministic | Sequential | Static | Discrete |
| Chess with a clock | Fully | Multi | Deterministic | Sequential | Semi | Discrete |
| Poker | Partially | Multi | Stochastic | Sequential | Static | Discrete |
| Taxi driving | Partially | Multi | Stochastic | Sequential | Dynamic | Continuous |
| Medical diagnosis | Partially | Single | Stochastic | Sequential | Dynamic | Continuous |
| Image analysis | Fully | Single | Deterministic | Episodic | Semi | Continuous |

## 5. Agent Architectures

### 5.1 Simple reflex agents

Select actions on the basis of the **current percept only**, ignoring history, using **condition–action rules** (if car-in-front-is-braking then initiate-braking).

```python
def simple_reflex_agent(percept):
    state = interpret_input(percept)
    rule = rule_match(state, rules)
    return rule.action
```

They work correctly only if the environment is **fully observable**. In partially observable environments they can fall into **infinite loops** (a vacuum without a location sensor moving Left forever from square A). Randomising the action can escape such loops.

### 5.2 Model-based reflex agents

Maintain an **internal state** that tracks aspects of the world not currently visible. Updating it requires a **transition model** (how the world evolves and how actions affect it) and a **sensor model** (how the world state is reflected in percepts). This handles partial observability.

### 5.3 Goal-based agents

Combine the model with **goal** information describing desirable situations. Action selection may require **search** and **planning** to find action sequences that reach the goal. Goal-based agents are more flexible than reflex agents because changing the goal does not require rewriting rules.

### 5.4 Utility-based agents

Goals provide only a binary happy/unhappy distinction. A **utility function** maps states (or state sequences) to real numbers measuring desirability. A rational utility-based agent chooses the action that maximises **expected utility**, which matters when goals conflict (speed vs. safety) or when goals can be achieved only with some probability.

### 5.5 Learning agents

Any of the above can be turned into a learning agent with four components:

- **Performance element**: selects external actions (the agent as previously described).
- **Learning element**: makes improvements to the performance element.
- **Critic**: tells the learning element how well the agent is doing with respect to a fixed **performance standard**.
- **Problem generator**: suggests exploratory actions that lead to new, informative experiences.

## 6. Exam Pitfalls

- The agent **function** is abstract; the agent **program** is its implementation.
- "Known" and "fully observable" are independent properties.
- A simple reflex agent with randomisation can outperform a deterministic one in partially observable settings, but a model-based agent is usually better still.
- Chess with a clock is **semidynamic**, not dynamic.
