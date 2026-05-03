import re
import os

app_css_path = "src/styles/app.css"
with open(app_css_path, "r") as f:
    content = f.read()

# Define the mapping of CSS sections to components (and their module CSS names)
component_mapping = {
    "Header": "App",
    "Main Layout": "App",
    "Editor View Toggle": "App",
    "Score Overlay": "App",
    "Session Summary": "App"
}

# The regex searches for `/* ===== <Section Name> ===== */`
# and matches everything until the next `/* ===== ` or EOF.
# But we need to handle "=====" differently. Sometimes it is `/* ===== <name> ===== */`.
# Or `/* ===== <name> =====`.
# Let's split by `/* ===== ` and then process.

pieces = content.split("/* ===== ")

remaining_css_pieces = [pieces[0]]


for piece in pieces[1:]:
    # Find the end of the section name
    end_idx = piece.find("*/")
    if end_idx == -1:
        end_idx = piece.find("\n")

    if end_idx == -1:
        remaining_css_pieces.append("/* ===== " + piece)
        continue

    section_name_full = piece[:end_idx].strip("= ")
    section_content = piece[end_idx + 2:]

    # special handling for multi-line comment header
    if "=====" in section_name_full:
        section_name_full = section_name_full.split("=====")[0].strip()

    section_name = section_name_full.strip()

    found = False
    for map_key, component_name in component_mapping.items():
        if component_name and map_key in section_name:
            module_file = f"src/components/{component_name}.module.css"
            if not os.path.exists("src/components/"): os.makedirs("src/components/")

            # Print for info
            print(f"Extracting '{section_name}' -> {module_file}")

            with open(module_file, "a") as mf:
                mf.write(f"/* Extracted from: {section_name} */\n")
                mf.write(section_content)
                mf.write("\n")
            found = True
            break

    if not found:
        remaining_css_pieces.append("/* ===== " + piece)

with open("src/styles/app_refactored.css", "w") as f:
    f.write("".join(remaining_css_pieces))

print("Extraction complete. Remaining CSS saved to app_refactored.css")
