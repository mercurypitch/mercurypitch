import os
import re

components_dir = "src/components"
css_file = "src/styles/app.css"

with open(css_file, "r") as f:
    css_content = f.read()

# Let's see what components exist
components = [f for f in os.listdir(components_dir) if f.endswith(".tsx")]

print(f"Found {len(components)} components.")
