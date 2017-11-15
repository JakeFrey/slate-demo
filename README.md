Demo for using a slate.json data model along with the slate editor in react to build test bank questions for zyBooks.

Will need to clone this repo as well as slate-server.

npm install in this repo, then npm start to begin the app on localhost:3000.
To start the flask server, export FLASK_APP=slate.py && flask run

Note: The two repos need to be in the same directory for export to word to work.

Key commands:
Shift+Enter: add new sibling (if in choice, adds choice. If in code block, adds a paragraph)
Shift+backspace: delete current choice
ctrl+Enter: Add new question after current
ctrl+backspace: Delete current question
Ctrl+b: add codeblock
Ctrl+e: add table
Ctrl+i: convert selected text to image
Ctrl+l: convert selected text to latex
