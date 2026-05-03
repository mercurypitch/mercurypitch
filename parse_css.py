import re
import os
import collections

css_content = open("src/styles/app.css").read()

# very basic parsing to get selectors and their rules
# this doesn't handle media queries properly if we just split by { }
# so let's do a basic regex approach or just identify all class selectors used in App.css
classes = re.findall(r'\.([a-zA-Z0-9_-]+)', css_content)

counter = collections.Counter(classes)
for c, count in counter.most_common(100):
    print(c, count)
