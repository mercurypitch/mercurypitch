import re
import os

components_dir = "src"

def kebab_to_camel(kebab_str):
    parts = kebab_str.split('-')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])

# List all module CSS files we generated
module_css_files = ["App.module.css"]

def process_file(filepath, module_name):
    with open(filepath, "r") as f:
        content = f.read()

    # Read the CSS module to find all class names
    css_filepath = os.path.join("src/components", f"{module_name}.module.css")
    if not os.path.exists(css_filepath):
        print(f"Skipping because {css_filepath} does not exist.")
        return False

    with open(css_filepath, "r") as f:
        css_content = f.read()

    # Extract all classes from CSS
    # Note: we need to grab valid CSS class names
    classes = re.findall(r'\.([a-zA-Z0-9_-]+)', css_content)
    classes = list(set(classes)) # Unique

    if not classes:
        print(f"No classes found in {css_filepath}")
        return False

    original_content = content

    # 1. Add import statement
    if "import styles from" not in content and f"import styles from '@/components/{module_name}.module.css'" not in content:
        # Find last import to place it after
        last_import_idx = content.rfind("import ")
        if last_import_idx != -1:
            end_of_line = content.find("\n", last_import_idx)
            content = content[:end_of_line+1] + f"import styles from '@/components/{module_name}.module.css'\n" + content[end_of_line+1:]
        else:
            content = f"import styles from '@/components/{module_name}.module.css'\n" + content

    # Helper function to replace class names in a given string
    def replace_classes_in_str(class_str):
        words = class_str.split()
        new_words = []
        for word in words:
            # Handle conditional classes or expressions carefully (this is a simplified approach)
            if word in classes:
                camel_word = kebab_to_camel(word)
                new_words.append(f"${{styles.{camel_word}}}")
            else:
                new_words.append(word)
        return " ".join(new_words)

    # 2. Replace static class="something"
    # Note: this simple regex may fail if class="something {dynamic}"
    def replace_static_class(match):
        class_str = match.group(1)

        # Check if it has solidjs dynamic parts or just plain string
        if '{' in class_str or '$' in class_str:
            return match.group(0) # Skip complex static strings for now

        words = class_str.split()
        has_match = False
        new_expr_parts = []

        for word in words:
            if word in classes:
                has_match = True
                camel_word = kebab_to_camel(word)
                new_expr_parts.append(f"styles.{camel_word}")
            else:
                new_expr_parts.append(f"'{word}'")

        if has_match:
            # Join with " " if multiple classes
            if len(new_expr_parts) == 1:
                if new_expr_parts[0].startswith("styles."):
                    return f"class={{{new_expr_parts[0]}}}"
                else:
                    return f'class="{new_expr_parts[0][1:-1]}"'
            else:
                # need template literal
                template_str = " ".join([p if p.startswith("'") else f"${{{p}}}" for p in new_expr_parts]).replace("'", "")
                return f"class={{`{template_str}`}}"

        return match.group(0)

    content = re.sub(r'class="([^"]+)"', replace_static_class, content)

    # 3. Replace dynamic class={`something ${cond ? 'a' : 'b'}`}
    # This is much harder to parse safely with regex.
    # Let's try replacing exact known words inside the template string.
    # We will just do a simple replace on the whole content for 'word' -> ${styles.word}
    # ONLY IF the word is an exact match and inside a class attribute (very hard).
    # Alternative: Use a basic token replacement.

    # Simple replace for string literals in dynamic classes: class={`some-class ${...}`}
    # We find class={`...`}
    def replace_dynamic_class(match):
        inner = match.group(1)

        # very basic: find words that match our classes, but outside of ${} blocks.
        # This is a naive parsing.
        new_inner = ""
        i = 0
        while i < len(inner):
            if inner[i:i+2] == "${":
                # skip until }
                end = inner.find("}", i)
                if end == -1: end = len(inner)
                new_inner += inner[i:end+1]
                i = end + 1
            else:
                # read a word
                match_word = re.match(r'([a-zA-Z0-9_-]+)', inner[i:])
                if match_word:
                    word = match_word.group(1)
                    if word in classes:
                        camel_word = kebab_to_camel(word)
                        new_inner += f"${{styles.{camel_word}}}"
                    else:
                        new_inner += word
                    i += len(word)
                else:
                    new_inner += inner[i]
                    i += 1
        return f"class={{`{new_inner}`}}"

    content = re.sub(r'class=\{`([^`]+)`\}', replace_dynamic_class, content)

    # Write changes if modified
    if content != original_content:
        with open(filepath, "w") as f:
            f.write(content)
        return True
    return False

process_file("src/App.tsx", "App")
