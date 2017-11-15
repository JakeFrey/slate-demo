import React from 'react'
import './App.css';
import './toolbar.css';
import './test.css';
import Pusher from 'pusher-js'

import { Editor, getEventRange, getEventTransfer } from 'slate-react'
import { Value, Block, Text, Range } from 'slate'
import { isKeyHotkey } from 'is-hotkey'
import Menu from './menu.js';
import LatexMenu from './latex-menu.js';
import Immutable from 'immutable';

import initialTest from './test-template.json'
import emptyTest from './empty-test.json'

import { findContainingQuestion } from './utilities.js'
import { onBackspace, onEnter, onDelete, onShiftEnter, onCtrlEnter,
         onCtrlBackspace, onShiftBackspace, onCtrlI, onCtrlR } from './key-utils.js'

var Latex = require('react-latex')
var axios = require('axios');

/**
 * A change function to standardize inserting questions.
 *
 * @param {Change} change
 * @param {Range} target
 */
function insertQuestion(change, insertAtStart) {
    const instructions = Block.create({ type: "instructions" });
    const choice1 = Block.create({ type: "choice" });
    const choice2 = Block.create({ type: "choice" });
    const choice3 = Block.create({ type: "choice" });
    const choice4 = Block.create({ type: "choice" });

    const choices = Block.create({ type: "choices" }).update('nodes', nodes => nodes.push(choice1)).update('nodes', nodes => nodes.push(choice2)).
          update('nodes', nodes => nodes.push(choice3)).update('nodes', nodes => nodes.push(choice4))
    const block = Block.create({ type: "question" }).update('nodes', nodes => nodes.push(instructions)).update('nodes', nodes => nodes.push(choices))

    // Num questions
    const questions = change.value.document.nodes.get(0).nodes
    const noQuestions = questions.size == 1 && questions.get(0).kind == 'text'
    const insertionIndex = insertAtStart || noQuestions ? 0 : change.value.document.nodes.get(0).nodes.size;

    change.insertNodeByKey("2", insertionIndex, block)
}

/**
 * Define the default node type.
 *
 * @type {String}
 */

const DEFAULT_NODE = 'paragraph'

const isLatexHotkey = isKeyHotkey('ctrl+l')
const isTableHotkey = isKeyHotkey('ctrl+e')
const isImageHotkey = isKeyHotkey('ctrl+i')
const isCodeblockHotkey = isKeyHotkey('ctrl+b')
const isShiftEnter = isKeyHotkey('shift+enter')
const isCtrlEnter = isKeyHotkey('ctrl+enter')

class App extends React.Component {

    /**
     * Deserialize the initial editor value.
     *
     * @type {Object}
     */
    state = {
        value: Value.fromJSON(initialTest),
        showContent: true,
        stateID: Math.random()
    }

    /**
     * Check if the current selection has a mark with `type` in it.
     *
     * @param {String} type
     * @return {Boolean}
     */

    hasMark = (type) => {
        const { value } = this.state
        return value.activeMarks.some(mark => mark.type == type)
    }

    /**
     * Check if the any of the currently selected blocks are of `type`.
     *
     * @param {String} type
     * @return {Boolean}
     */

    hasBlock = (type) => {
        const { value } = this.state
        return value.blocks.some(node => node.type == type)
    }

    /**
     * On update, update the menu.
     */
    componentWillMount = () => {
        this.pusher = new Pusher('013f281e06025adc67d2', {
            cluster: 'us2'
        });
        this.getState = this.pusher.subscribe('messages');
    }
    /**
     * On update, update the menu.
     */
    componentDidMount = () => {
        this.updateMenu()
        this.updateLatexMenu()
        this.getState.bind('new_message', message => {
            const messageState = Value.fromJSON(message.json)

            if (message.update && this.state.stateID !== message.stateID) {
                this.setState({value: Value.fromJSON(message.json), mostRecentChange: message.time, update: false})
            }
        }, this);
   }

    componentDidUpdate = () => {
        this.updateMenu()
        this.updateLatexMenu()
    }

    /**
     * Update the menu's absolute position.
     */

    updateMenu = () => {
        const { value } = this.state
        const menu = this.menu
        if (!menu) return

        if (value.focusBlock && value.focusBlock.type == 'image') {
            const selection = window.getSelection()
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()
            menu.style.opacity = 1
            menu.style.top = `${rect.top + window.scrollY - menu.offsetHeight}px`
            menu.style.left = `${rect.left + window.scrollX - menu.offsetWidth / 8 + rect.width / 2}px`
        }
        else if (value.isBlurred || value.isEmpty) {
            menu.removeAttribute('style')
            return
        }
    }

    updateLatexMenu = () => {
        const { value } = this.state
        const menu = this.latexMenu
        if (!menu) return

        // Get the selected text
        const selectedKey = value.selection.anchorKey
        const selectedIndex = value.selection.focusOffset

        if (selectedKey) {
            const selectedNode = value.document.getNode(selectedKey)
            let totalNumChars = 0
            let selectedLeaf = null

            if (selectedNode) {
                // Determine which leaf the selection is in
                selectedNode.getLeaves().forEach(leaf => {
                    totalNumChars += leaf.text.length

                    if (selectedIndex < totalNumChars && !selectedLeaf) {
                        selectedLeaf = leaf
                    }
                })

                if (selectedLeaf && selectedLeaf.marks.some(mark => mark.type == 'plainTextLatex')) {
                    const selection = window.getSelection()
                    const range = selection.getRangeAt(0)
                    const rect = range.getBoundingClientRect()
                    menu.style.opacity = 1
                    menu.style.top = `${rect.top + window.scrollY - menu.offsetHeight}px`
                    menu.style.left = `${rect.left + window.scrollX - menu.offsetWidth / 8 + rect.width / 2}px`
                }
                else if (value.isBlurred || value.isEmpty) {
                    menu.removeAttribute('style')
                    return
                }
            }
        }
    }

    /**
     * Save the `menu` ref.
     *
     * @param {Menu} menu
     */

    menuRef = (menu) => {
        this.menu = menu
    }

    latexMenuRef = (menu) => {
        this.latexMenu = menu
    }

    /**
     * On change, save the new `state`.
     *
     * @param {Change} change
     */
    
    onChange = ({ value }) => {
        this.setState({ value, json: JSON.stringify(value.toJSON()), plainText: value.document.nodes.get(0).text })
        this.renderToolbar()

        // if (JSON.stringify(value.document) !== JSON.stringify(this.state.value.document)) {
        //     axios.post('http://localhost:5000/messages', {
        //         text: value.toJSON(),
        //         time: new Date(),
        //         update: this.state.value.document.text !== value.document.text,
        //         stateID: this.state.stateID
        //     })
        // }
    }

    /**
     * On key down, if it's a formatting command toggle a mark.
     *
     * @param {Event} event
     * @param {Change} change
     * @return {Change}
     */

    onKeyDown = (event, change) => {
        if (isShiftEnter(event)) {
            return onShiftEnter(event, change)
        }
        else if (isCtrlEnter(event)) {
            return onCtrlEnter(event, change)
        }
        else if (event.shiftKey && event.keyCode==8) {
            return onShiftBackspace(event, change)
        }
        else if (event.ctrlKey && event.keyCode==8) {
            return onCtrlBackspace(event, change)
        }
        else if (event.ctrlKey && event.keyCode==82) {
            return onCtrlR(event, change)
        }
        else if (isImageHotkey(event)) {
            return onCtrlI(event, change)
        }
        else {
            switch (event.key) {
                case 'Backspace': return onBackspace(event, change)
                case 'Delete': return onDelete(event, change)
                case 'Enter': return onEnter(event, change)
            }

            let changesMade = false
            let mark = null

            if (isLatexHotkey(event)) {
                mark = 'latex'
                event.preventDefault()
                change.toggleMark(mark)
                changesMade = true
            }
            else if (isTableHotkey(event)) {
                event.preventDefault()
                changesMade = true
                this.onClickBlock('table')
            }

            else if (isCodeblockHotkey(event)) {
                event.preventDefault()
                changesMade = true
                this.onClickBlock('codeblock')            
            }

            return changesMade || null
        }
    }

    /**
     * When a mark button is clicked, toggle the current mark.
     *
     * @param {Event} event
     * @param {String} type
     */

    onClickMark = (type) => {
        const { value } = this.state
        const change = value.change().toggleMark(type)
        this.onChange(change)
    }

    /**
     * When a block button is clicked, toggle the block type.
     *
     * @param {Event} event
     * @param {String} type
     */

    onClickBlock = (type) => {
        const { value } = this.state
        const change = value.change()
        const { document } = value

        const isActive = this.hasBlock(type)

        // Handle tables
        if (type == 'table') {
            debugger;
            const cell1 = Block.create({ type: 'table-cell' })
            const cell2 = Block.create({ type: 'table-cell' })
            const cell3 = Block.create({ type: 'table-cell' })
            const cell4 = Block.create({ type: 'table-cell' })

            const row1 = Block.create({ type: "table-row" }).update('nodes', nodes => nodes.push(cell1)).update('nodes', nodes => nodes.push(cell2))
            const row2 = Block.create({ type: "table-row" }).update('nodes', nodes => nodes.push(cell3)).update('nodes', nodes => nodes.push(cell4))
            const table = Block.create({ type: 'table' }).update('nodes', nodes => nodes.push(row1)).update('nodes', nodes => nodes.push(row2))

            change.insertBlock(table)
        }
        else {
            change.insertBlock(Block.create({ type: type }))
        }

        this.onChange(change)
    }

   //                 {this.renderToolbar()}
    // Render the editor.
    render() {
        const downloadPath = this.state.downloadPath;

        return (
                <div className='slate-app'>
                <Menu
                    menuRef={this.menuRef}
                    value={this.state.value}
                    onChange={this.onChange}
                    textToImage={this.textToImage}
                />
                <LatexMenu
                    menuRef={this.latexMenuRef}
                    value={this.state.value}
                    onChange={this.onChange}
                    textToLatex={this.textToLatex}
                />
                <div className='header'>
                    <div className='logo'>
                        <img width='83px' height='22px' src='./logo.svg'/>
                    </div>
                </div>
                <div className='slate-content'>
                    <div className='containing-card'>
                        <div className='toggle-view-container'>
                            <div className='segmented-control'>
                                <button onClick={() => this.setContentShown(true)} data-active={this.state.showContent} className='zb-button'>Output</button>
                                <button onClick={() => this.setContentShown(false)} data-active={!this.state.showContent} className='zb-button'>Data</button>
                            </div>
                            <button onClick={() => this.exportToWord()} className='zb-button output-button'>Export to word</button>
                        </div>
                        {this.renderContent()}
                    </div>
                </div>
            </div>
        )
    }

    /**
     * Renders content to be shown in the main card. Will either be the visual representation of a test or the json/text data
     *
     * @return {Element}
     */
    renderContent = () => {
        if (this.state.showContent) {
            return (
                <div className='card-content'>
                    <h1 className='card-header'>Test bank demo</h1>
                    <div className="editor-container">
                        {this.renderEditor()}
                    </div>
                </div>
            )
        }
        else {
            return (
                <div className='card-content'>
                    <h2>Plain text of test questions</h2>
                    <div>{this.state.plainText}</div>
                    <h2>Slate json</h2>
                    <div>{this.state.json}</div>
                </div>
            )
        }
    }

    /**
     * Sets which content should be shown
     *
     * @return {Element}
     */

    setContentShown = (showContent) => {
        this.setState({showContent: showContent})
    }

    /**
     * Render the toolbar.
     *
     * @return {Element}
     */

    renderToolbar = () => {
        let showQuestionButtons = false
        let showChoiceButtons = false

        const value = this.state.value

        if (value.selection.focusKey) {
            const selectedNode = value.document.getNode(value.selection.focusKey)
            const questions = value.document.nodes.get(0).nodes
            questions.forEach(question => {
                if (question.hasDescendant) {
                    if (question.hasDescendant(value.selection.focusKey)) {
                        showQuestionButtons = true
                    }

                    if (question.nodes.get(1)) { 
                        question.nodes.get(1).nodes.forEach(choice => {
                            if (choice.hasDescendant && choice.hasDescendant(value.selection.focusKey)) {
                                showChoiceButtons = true
                            }
                        })
                    }
                }
            })
        }

        const deleteQuestionHTML = ''

        const markCorrectHTML = showChoiceButtons ? (
                <button className="zb-button" onMouseDown={this.markCorrect}>
                    <span>Mark correct</span>
                </button>
        ) : ''
                // <div className='right-buttons'>
                //     {markCorrectHTML}
                // </div>
        return (
            <div className="toolbar">
                <div className='left-buttons'>
                    <button className="zb-button" onClick={() => this.addQuestionEnd()}>
                        <span className="material-icons">add</span>
                        <span>Question</span>
                    </button>

                    <button className="zb-button" onClick={() => this.addChoice()}>
                        <span className="material-icons">add</span>
                        <span>Choice</span>
                    </button>

                    <button className="zb-button" onClick={() => this.onClickMark('latex')}>
                        <span>Mark latex</span>
                    </button>

                <button className="zb-button" onClick={() => this.onClickBlock('codeblock')}>
                        <span className="material-icons">add</span>
                        <span>Codeblock</span>
                    </button>

                <button className="zb-button" onClick={() => this.onClickBlock('table')}>
                        <span className="material-icons">add</span>
                        <span>Table</span>
                    </button>

                    <button className="zb-button" onMouseDown={this.onClickImage}>
                        <span className="material-icons">add</span>
                        <span>Image</span>
                    </button>
                </div>

            </div>
        )
    }

    /**
     * Render the editor.
     *
     * @return {Element} element
     */

    renderEditor = () => {
        return (
            <div className="editor">
                <Editor
                    onChange={this.onChange}
                    onKeyDown={this.onKeyDown}
                    renderNode={this.renderNode}
                    value={this.state.value}
                    renderMark={this.renderMark}/>
            </div>
        )
    }

   renderNode = (props) => {
       const { attributes, node, isSelected } = props
        switch (props.node.type) {
        case 'test': return <ol {...attributes}>{props.children}</ol>
        case 'question': return <li {...attributes} className="question">{props.children}</li>
        case 'instructions': return <div {...attributes} className="instructions">{props.children}</div>
        case 'choices': return <ol {...attributes} className="choices" type="a">{props.children}</ol>
        case 'choice': return <li {...attributes} className="choice">{props.children}</li>
        case 'label': return <div {...attributes} className="label">{props.children}</div>
        case 'codeblock': return <div className="codeblock-container"><div {...attributes} className="codeblock">{props.children}</div></div>
        case 'answer': return <li {...attributes}>{props.children}</li>

        case 'table': return <table><tbody {...attributes}>{props.children}</tbody></table>
        case 'table-row': return <tr {...attributes}>{props.children}</tr>
        case 'table-cell': return <td {...attributes}>{props.children}</td>
        case 'image': {
            const src = node.data.get('src')
            const className = isSelected ? 'active' : null
            const style = { display: 'block' }
            return (
                    <img src={src} className={className} style={style} {...attributes} onMouseDown={this.imageClicked}/>
            )
        }
        case 'plainTextImage': {
            const src = node.data.get('src')
            return (
                    <div {...attributes}>{props.children}</div>
            )
        }
        }
    }

    renderMark = (props) => {
        switch (props.mark.type) {
        case 'latex': return <span className="latex-text" {...props.attributes} onMouseDown={this.onLatexMouseDown}><Latex>{props.children}</Latex></span>
        case 'plainTextLatex': return <span>{props.children}</span>
        }
    }

    // V2
    // textToImage = (event) => {
    //     event.preventDefault()

    //     const state = this.state.state
    //     const change = state.change()

    //     // Get key for the image selected
    //     const imageKey = state.focusBlock.key
    //     const imageNode = state.document.getNode(imageKey)
    //     const srcNodes = Immutable.List([Text.create({ "text": imageNode.data.get('src')})])
    //     const paragraphNode = imageNode.set("type", "paragraph").set("isVoid", false)
    //           .set('nodes', srcNodes)

    //     change.replaceNodeByKey(imageKey, paragraphNode)
    //     this.onChange(change)
    // }

    imageClicked = (event) => {
        event.preventDefault()

        const value = this.state.value
        const change = value.change()

        // Get key for the image selected
        const imageKey = event.target.getAttribute("data-key")
        const imageNode = value.document.getNode(imageKey)
        const srcNodes = Immutable.List([Text.create({ "text": imageNode.data.get('src')})])
        const updatedImageNode = imageNode.set("type", "plainTextImage").set("isVoid", false)
              .set('nodes', srcNodes)

        change.replaceNodeByKey(imageKey, updatedImageNode)

        this.onChange(change)
    }

    textToImage = (event) => {
        event.preventDefault()

        const value = this.state.value
        const change = value.change()

        // Get key for the image selected
        const imageKey = value.focusBlock.key
        const imageTextNode = value.document.getNode(imageKey)
        const newData = imageTextNode.data.set('src', imageTextNode.text)
        const emptyNodes = Immutable.List([Text.create({ "text": " "})])
        const updatedImageNode = imageTextNode.set("type", "image").set("isVoid", true)
              .set("data", newData)
              .set('nodes', emptyNodes)

        change.replaceNodeByKey(imageKey, updatedImageNode)

        this.onChange(change)
    }

    /**
     * On clicking the image button, prompt for an image and insert it.
     *
     * @param {Event} event
     */

    onLatexMouseDown = (event) => {

        let currentElement = event.target;
        let numParent = 0

        // First step is to find the containing parent and data-key
        while (currentElement.className.indexOf('latex-text') == -1) {
            currentElement = currentElement.parentElement
            numParent += 1

            if (numParent > 20) {
                return
            }
        }

        const value = this.state.value
        const change = value.change()

        const latexOffsetKey = currentElement.parentElement.getAttribute("data-offset-key")
        const latexKey = latexOffsetKey.substring(0, latexOffsetKey.indexOf(":"))
        const latexOffset = latexOffsetKey.substring(latexOffsetKey.indexOf(":") + 1)
        const parentNode = value.document.getNode(latexKey)
        const latexLeaf = parentNode.getLeaves().get(parseInt(latexOffset, 10))

        // The index of the latex text within the parent text node
        const startIndex = parentNode.text.indexOf(latexLeaf.text)
        const endIndex = parentNode.text.indexOf(latexLeaf.text) + latexLeaf.text.length

        // Set the latex as selected in the change, then modify the marks
        const newRange = Range.create({ anchorKey: latexKey, focusKey: latexKey, anchorOffset: startIndex,
                                        focusOffset: endIndex, isBackward: false, isFocused: true })
        change.select(newRange)
        change.removeMark("latex")
        change.addMark("plainTextLatex")

        this.onChange(change)
    }

    textToLatex = (event) => {
        event.preventDefault()

        const value = this.state.value
        const change = value.change()

        // Get the selected text
        const selectedKey = value.selection.anchorKey
        const selectedIndex = value.selection.focusOffset
        const selectedNode = value.document.getNode(selectedKey)
        let totalNumChars = 0
        let selectedLeaf = null

        // Determine which leaf the selection is in
        selectedNode.getLeaves().forEach(leaf => {
            totalNumChars += leaf.text.length

            if (selectedIndex < totalNumChars && !selectedLeaf) {
                selectedLeaf = leaf
            }
        })


        // The index of the latex text within the parent text node
        const startIndex = selectedNode.text.indexOf(selectedLeaf.text)
        const endIndex = selectedNode.text.indexOf(selectedLeaf.text) + selectedLeaf.text.length

        // Set the latex as selected in the change, then modify the marks
        const newRange = Range.create({ anchorKey: selectedKey, focusKey: selectedKey, anchorOffset: startIndex,
                                        focusOffset: endIndex, isBackward: false, isFocused: true })
        change.select(newRange)
        change.addMark("latex")
        change.removeMark("plainTextLatex")

        this.onChange(change)
    }

    /**
     * On clicking the image button, prompt for an image and insert it.
     *
     * @param {Event} event
     */
    onClickImage = () => {
        const src = window.prompt('Enter the URL of the image:')
        if (!src) return

        const change = this.state.value.change()
        const block = Block.create({ type: "image", isVoid: true, data: { src } })
        change.insertBlockAtRange(change.value.selection, block)
        this.onChange(change)
    }

    exportToWord = () => {
        axios.post(`http://localhost:5000/create_test_bank`, {
                   questions: this.state.value.toJSON(),
                   
                  }).then(response => {
                      var link=document.createElement('a');
                      link.href='http://localhost:5000/static/testbank.docx'
                      link.download="testbank.docx";
                      link.click();
                  })
    }
}

export default App;
