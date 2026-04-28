
## Problem Statement

Given a corpus of reasoning traces, build a system that — given a novel query — synthesises a new reasoning trace by retrieving and composing stored trace patterns via Dense Associative Memory (Dense AM) dynamics. The synthesis is not a retrieval of a stored trace, nor LLM generation from scratch; it is an emergent fixed-point in the energy landscape of the stored corpus, decoded back into language by a frozen LLM conditioned on a lightweight trained projector.

**Key distinction:** If the corpus has compositional substructure (shared reasoning sub-patterns across traces), the AM dynamics will produce superposition attractors — fixed points that correspond to no single stored trace but are a meaningful blend of several. The system exploits this geometry.

---

## Architecture

```
query_text
    → [Encoder] → q ∈ ℝ^d_enc
    → [Hopfield Dynamics on Ξ, β] → x* ∈ ℝ^d_enc      # fixed-point; may be novel superposition
    → [Projector P_θ] → soft_prefix ∈ ℝ^{n_soft × d_llm}
    → [Frozen LLM] ([soft_prefix | query_tokens]) → novel trace
```

### Components

|Component|Role|Trained?|
|---|---|---|
|Encoder|Maps traces and queries to ℝ^d|Frozen (pre-trained)|
|Memory matrix Ξ ∈ ℝ^{d × N}|Stores all encoded traces|No — fixed at index time|
|Hopfield dynamics|Iterative fixed-point convergence|No — fixed update rule|
|β (inverse temperature)|Controls recall vs synthesis tradeoff|Optionally tuned|
|Projector P_θ|Maps x* to LLM soft token prefix|**Yes — only trained component**|
|LLM|Decodes soft prefix into trace text|Frozen|

### Hopfield Update Rule

$$x^{t+1} = \Xi \cdot \text{softmax}(\beta \cdot \Xi^\top x^t), \quad \text{repeat until } |x^{t+1} - x^t| < \epsilon$$

The output `weights = softmax(β · Ξᵀ x*)` is a diagnostic: a peaked distribution means pure retrieval; a broad distribution means superposition synthesis.

---

## Model Recommendations

|Component|PoC|Production|
|---|---|---|
|Encoder|`text-embedding-3-small` (OpenAI API)|Fine-tuned `e5-mistral-7b-instruct` or `SFR-Embedding-2_R`|
|Frozen LLM|`Qwen2.5-1.5B-Instruct` (runs on CPU/single GPU)|`Llama-3.1-8B-Instruct` or `Mistral-7B-Instruct-v0.3`|
|Projector P_θ|2-layer MLP, ~10M params|3-layer MLP with LayerNorm, ~100M params|
|AM backend|In-memory numpy/torch tensor|FAISS-backed with GPU index|

---

## Part 1: Proof of Concept

**Goal:** Validate that the AM dynamics produce meaningful fixed-points and that a projector can decode them. Use ~500 traces. Do not worry about scale, efficiency, or production concerns.

### Step 1 — Prepare a Small Trace Corpus

```python
# Use a public dataset of reasoning traces as a stand-in
# GSM8K (math), StrategyQA, or ARC-Challenge with CoT completions
# Aim for ~500 traces with known compositional substructure

from datasets import load_dataset
ds = load_dataset("gsm8k", "main", split="train").select(range(500))
traces = [f"Problem: {r['question']}\nSolution: {r['answer']}" for r in ds]
```

### Step 2 — Encode and Store

```python
import numpy as np
import torch
import torch.nn.functional as F
from openai import OpenAI

client = OpenAI()

def encode_batch(texts, model="text-embedding-3-small"):
    resp = client.embeddings.create(input=texts, model=model)
    return np.array([r.embedding for r in resp.data])

Xi_np = encode_batch(traces)               # (N, d)
Xi = torch.tensor(Xi_np, dtype=torch.float32).T  # (d, N)
Xi = F.normalize(Xi, dim=0)                # normalize columns
```

### Step 3 — Hopfield Retrieval (the core dynamics)

```python
def hopfield_retrieve(query_embedding, Xi, beta=5.0, n_steps=10, tol=1e-5):
    """
    Returns:
        x_star: fixed-point embedding (d,) — may be a superposition
        weights: (N,) softmax weights — diagnostic for retrieval vs synthesis
    """
    x = F.normalize(torch.tensor(query_embedding, dtype=torch.float32), dim=-1)
    for _ in range(n_steps):
        logits = beta * (Xi.T @ x)              # (N,)
        weights = F.softmax(logits, dim=-1)      # (N,)
        x_new = F.normalize(Xi @ weights, dim=-1)
        if torch.norm(x_new - x) < tol:
            break
        x = x_new
    return x, weights

# Probe: is x* a retrieval or synthesis?
# Effective number of traces contributing = exp(entropy of weights)
entropy = -(weights * weights.log()).sum()
n_effective = entropy.exp().item()
print(f"Fixed-point draws from ~{n_effective:.1f} stored traces")
```

### Step 4 — Train the Projector

```python
import torch.nn as nn

class Projector(nn.Module):
    def __init__(self, d_enc=1536, d_llm=2048, n_soft=8):
        super().__init__()
        self.n_soft = n_soft
        self.net = nn.Sequential(
            nn.Linear(d_enc, d_enc),
            nn.GELU(),
            nn.Linear(d_enc, n_soft * d_llm)
        )
        self.d_llm = d_llm

    def forward(self, x_star):                          # (B, d_enc)
        return self.net(x_star).view(-1, self.n_soft, self.d_llm)


# Training loop — leave-one-out reconstruction
# For each trace j: perturb ξ_j, retrieve from Ξ_{-j}, decode with frozen LLM
# Loss: cross-entropy on the gold trace token sequence
```

> **Shortcut for PoC:** Skip leave-one-out. Instead, train the projector using the full Ξ (including ξ_j), accepting that the AM will perfectly recall ξ_j. This validates the projector's ability to decode a fixed-point embedding into text — the harder synthesis test comes in Step 5.

### Step 5 — Inference and Qualitative Evaluation

```python
from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-1.5B-Instruct")
llm = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-1.5B-Instruct")
llm.eval()

def generate_trace(query_text, Xi, projector, llm, tokenizer, beta=5.0):
    # 1. Encode query
    q_emb = encode_batch([query_text])[0]

    # 2. AM dynamics → fixed point
    x_star, weights = hopfield_retrieve(q_emb, Xi, beta=beta)

    # 3. Project to soft prefix
    with torch.no_grad():
        soft_prefix = projector(x_star.unsqueeze(0))       # (1, n_soft, d_llm)

    # 4. Embed query tokens
    input_ids = tokenizer(query_text, return_tensors="pt").input_ids
    token_embeds = llm.model.embed_tokens(input_ids)       # (1, seq, d_llm)

    # 5. Prepend soft prefix and generate
    full_embeds = torch.cat([soft_prefix, token_embeds], dim=1)
    with torch.no_grad():
        out = llm.generate(inputs_embeds=full_embeds, max_new_tokens=300)
    return tokenizer.decode(out[0], skip_special_tokens=True), weights
```

### PoC Evaluation Checklist

- [ ] `n_effective > 1` for out-of-distribution queries → synthesis is happening
- [ ] Generated traces are coherent and on-topic
- [ ] Varying `β` from 1→20 shifts behaviour from blended to exact recall
- [ ] Traces with shared sub-structure (e.g., two inductive proofs) produce meaningful superpositions

---

## Part 2: Production Implementation

### Scale Differences from PoC

|Concern|PoC|Production|
|---|---|---|
|Corpus size|~500 traces|50k–500k traces|
|Ξ storage|In-memory tensor|FAISS GPU index with quantisation|
|Encoder|API call|Batched local inference|
|Projector training|Full corpus in Ξ|Leave-one-out with hard negatives|
|LLM|1.5B, CPU|7–8B, quantised, GPU|
|β|Fixed scalar|Learnable, per-query or per-cluster|

### Key Additions over PoC

**1. Structure-preserving encoder fine-tuning**

Fine-tune the encoder with a contrastive objective so traces sharing reasoning sub-steps are geometrically closer than superficially similar but structurally different traces. Use `AnglE` loss or `MultipleNegativesRankingLoss` from `sentence-transformers`.

```python
# Positive pairs: traces using the same core strategy (labelled or mined via clustering)
# Negative pairs: traces that look similar in surface form but differ in strategy
from sentence_transformers import SentenceTransformer, losses
```

**2. Hierarchical trace decomposition**

Rather than embedding full traces, decompose into steps and embed each step. Store steps, not episodes. At retrieval time, compose a novel trace by chaining AM-retrieved steps. This is where the richest compositional behaviour emerges.

**3. Scalable AM backend**

For 50k+ traces, exact matrix multiplication becomes expensive. Use FAISS with a flat inner-product index as the AM backend — this approximates the Hopfield softmax with ANNS but supports iterative updates.

```python
import faiss
index = faiss.IndexFlatIP(d)
index = faiss.index_cpu_to_gpu(res, 0, index)   # GPU
index.add(Xi_np.astype(np.float32))
```

For true iterative dynamics at scale, implement one Hopfield step as: `scores, ids = index.search(x, top_k)` then `x_new = weighted_sum(Xi[ids], softmax(beta * scores))`.

**4. Projector training with leave-one-out and hard negatives**

```
For each trace ξ_j:
    Build Xi_{-j}
    Perturb ξ_j with: (a) step dropout, (b) Gaussian noise in embedding space, (c) prefix-only cue
    Retrieve x* from Xi_{-j}
    Decode with frozen LLM
    Loss = CrossEntropy(output, ξ_j) + λ * ||x* - ξ_j||²
```

**5. Inference serving**

```
Query → Encoder (batched, async) → Hopfield (GPU matmul, ~3 iterations) → Projector (negligible) → LLM (vLLM or TGI with prefix caching)
```

Latency budget (7B LLM, A100):

- Encoding: ~20ms
- Hopfield (50k traces, 3 steps): ~15ms
- Projector: <1ms
- LLM generation (200 tokens): ~400ms
- **Total: ~450ms**

---

## References

|Reference|Relevance|
|---|---|
|[Ramsauer et al., 2021 — Hopfield Networks is All You Need](https://arxiv.org/abs/2008.02217)|Dense AM formulation, MHN update rule, connection to attention|
|[Millidge et al., 2022 — Universal Hopfield Networks](https://arxiv.org/abs/2202.04557)|Generalised energy functions, polynomial and exponential interactions|
|[Hu et al., 2023 — HippoRAG](https://arxiv.org/abs/2405.14831)|Associative memory applied to knowledge retrieval, hippocampal analogy|
|[Zhang et al., 2022 — LLaMA-Adapter](https://arxiv.org/abs/2303.16199)|Soft prefix injection into frozen LLMs — direct inspiration for projector design|
|[Su et al., 2023 — AnglE Loss](https://arxiv.org/abs/2309.12307)|Encoder fine-tuning for geometry-preserving embeddings|
|[h透明 — hf-hopfield-layers](https://github.com/ml-jku/hopfield-layers)|PyTorch implementation of MHN layers (ML-JKU, authors of Ramsauer et al.)|
|[sentence-transformers](https://github.com/UKPLab/sentence-transformers)|Contrastive fine-tuning of encoders|
|[vLLM](https://github.com/vllm-project/vllm)|Production LLM serving with prefix caching|
|[FAISS](https://github.com/facebookresearch/faiss)|Scalable approximate inner-product search for large Ξ|