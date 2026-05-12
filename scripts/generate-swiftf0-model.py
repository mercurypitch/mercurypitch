#!/usr/bin/env python3
"""
Generate SwiftF0 ONNX model for pitch detection benchmarking.

SwiftF0 takes 132 frequency bins (FFT bins 3-134 at 16000 Hz) and outputs
200 logits representing pitch probabilities from 46.875 Hz to 2093.75 Hz.

The model is a single linear layer that maps input frequency magnitudes to
pitch bin logits, with Gaussian-spread weights centered at the expected
output bin for each input frequency.
"""

import math
import numpy as np
import onnx
from onnx import helper, TensorProto

# Constants
INPUT_SIZE = 132
OUTPUT_SIZE = 200
FFT_SIZE = 2048
SAMPLE_RATE = 16000

F_MIN = 46.875
F_MAX = 2093.75
LOG2_RATIO = math.log2(F_MAX / F_MIN)

# Input bin i (0-indexed) corresponds to FFT bin (i + 3)
# Frequency of FFT bin b: b * SAMPLE_RATE / FFT_SIZE
def input_bin_to_freq(i: int) -> float:
    return (i + 3) * SAMPLE_RATE / FFT_SIZE

# Output bin j maps to frequency
def output_bin_to_freq(j: int) -> float:
    return F_MIN * (2.0 ** (j * LOG2_RATIO / OUTPUT_SIZE))

# Target output bin for a given frequency
def freq_to_output_bin(freq: float) -> float:
    if freq <= F_MIN:
        return 0.0
    if freq >= F_MAX:
        return float(OUTPUT_SIZE - 1)
    return OUTPUT_SIZE * math.log2(freq / F_MIN) / LOG2_RATIO

# Build weight matrix W[output_bins, input_bins]
# Each column i represents the response of input bin i across output bins
# We use a Gaussian centered at the expected output bin
sigma = 2.5  # narrow peak for clean frequency detection

weights = np.zeros((OUTPUT_SIZE, INPUT_SIZE), dtype=np.float32)

for i in range(INPUT_SIZE):
    freq = input_bin_to_freq(i)
    j_center = freq_to_output_bin(freq)

    # Don't create peaks for extremely low frequencies (below F_MIN)
    if freq < F_MIN:
        continue

    # Gaussian column: strength decays with distance from center bin
    for j in range(OUTPUT_SIZE):
        dist = j - j_center
        weights[j, i] = math.exp(-(dist * dist) / (2 * sigma * sigma))

# Bias: small positive value so noise doesn't dominate
bias = np.ones(OUTPUT_SIZE, dtype=np.float32) * 0.01

# Create ONNX graph
input_tensor = helper.make_tensor_value_info(
    'input', TensorProto.FLOAT, [1, 1, 1, INPUT_SIZE]
)
output_tensor = helper.make_tensor_value_info(
    'output', TensorProto.FLOAT, [1, OUTPUT_SIZE]
)

# Weight initializer: shape [OUTPUT_SIZE, INPUT_SIZE]
weight_init = helper.make_tensor(
    'linear.weight', TensorProto.FLOAT, [OUTPUT_SIZE, INPUT_SIZE],
    weights.tobytes(), raw=True
)

bias_init = helper.make_tensor(
    'linear.bias', TensorProto.FLOAT, [OUTPUT_SIZE],
    bias.tobytes(), raw=True
)

# Transpose input from [1, 1, 1, 132] to [1, 132] then matmul with W^T [132, 200]
# Actually: input [1, 1, 1, 132] -> Squeeze/Reshape to [1, 132] -> Gemm with [132, 200]
# Simpler: use MatMul
# input shape is [1, 1, 1, 132], we need [1, 200] output
# Approach: reshape to [1, 132], matmul with [132, 200] -> [1, 200]

reshape_node = helper.make_node(
    'Reshape',
    inputs=['input', 'reshape_shape'],
    outputs=['reshaped'],
    name='reshape_input'
)

reshape_shape_init = helper.make_tensor(
    'reshape_shape', TensorProto.INT64, [2],
    np.array([1, INPUT_SIZE], dtype=np.int64).tobytes(), raw=True
)

# Gemm: Y = A * B + C
# A: [1, 132], B: [200, 132], C: [200]
# Gemm with transB=1 means Y = A * B^T + C = [1, 132] * [132, 200] + [200] = [1, 200]
gemm_node = helper.make_node(
    'Gemm',
    inputs=['reshaped', 'linear.weight', 'linear.bias'],
    outputs=['output'],
    transB=1,
    name='linear'
)

graph = helper.make_graph(
    nodes=[reshape_node, gemm_node],
    name='SwiftF0Model',
    inputs=[input_tensor],
    outputs=[output_tensor],
    initializer=[weight_init, bias_init, reshape_shape_init],
)

# Set opset
opset_imports = [helper.make_opsetid('', 13)]

model = helper.make_model(
    graph,
    producer_name='mercury-pitch-v2',
    opset_imports=opset_imports,
)

# Validate
onnx.checker.check_model(model)

# Save
output_path = 'public/models/swiftf0.onnx'
onnx.save(model, output_path)
print(f'Model saved to {output_path}')
print(f'Model size: {model.ByteSize()} bytes')
print(f'Input:  [1, 1, 1, {INPUT_SIZE}]')
print(f'Output: [1, {OUTPUT_SIZE}]')

# Quick test: print input/output mappings for a few test frequencies
test_freqs = [261.63, 440.0, 523.25, 880.0]
print('\nTest frequency mappings:')
for f in test_freqs:
    target_j = freq_to_output_bin(f)
    pred_freq = output_bin_to_freq(target_j)
    input_i = (f * FFT_SIZE / SAMPLE_RATE) - 3
    print(f'  {f:.1f} Hz -> input bin ~{input_i:.1f} -> output bin ~{target_j:.1f} -> {pred_freq:.1f} Hz')
