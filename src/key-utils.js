import { Value, State, Slate, Block, Text, Range, Data } from 'slate'
import { findContainingQuestion, insertQuestion } from './utilities.js'
import Immutable from 'immutable';

export function onBackspace(event, change) {
    const focusedNode = change.value.focusBlock
    const { value } = change

    // Delete a question if it is all selected and backspace, or if backspace on instructions when there isn't any text on the question
    if (focusedNode.type === 'instructions') {
        const parentQuestion = findContainingQuestion(focusedNode, change.value)
        const test = change.value.document.nodes.get(0)
        
        if (!parentQuestion.text.length) {
            if (test.nodes.size > 1) {
                change.removeNodeByKey(parentQuestion.key)
            }
            event.preventDefault()
            return true
        }
    }

    // Delete choice if there isn't any choice text and there is more than one choice
    else if (focusedNode.type === 'choice') {
        const parentQuestion = findContainingQuestion(focusedNode, change.value)
        
        if (!focusedNode.text.length || focusedNode.text === '*') {
            if (parentQuestion.nodes.get(1).nodes.size > 1) {
                change.removeNodeByKey(focusedNode.key)
            }
            event.preventDefault()
            return true
        }
    }

    // Don't do anything in tables if at the start of a cell
    else if (focusedNode.type === 'table-cell') {
        const { value } = change
        const { document, selection } = value
        const { startKey } = selection
        const startNode = document.getDescendant(startKey)

        if (selection.isAtStartOf(startNode)) {
            const previous = document.getPreviousText(startNode.key)
            if (previous) {
                const prevBlock = document.getClosestBlock(previous.key)

                if (value.startOffset != 0) return
                event.preventDefault()
                return true
            }
        }
    }

    // Delete codeblock if at the start and no text or all text selected
    else if (focusedNode.type === 'codeblock') {
        if (!focusedNode.text.length) {
            change.removeNodeByKey(focusedNode.key)
            event.preventDefault()
            return true
        }
    }

    return
}

/**
   
*/
export function onDelete(event, change) {
    const focusedNode = change.value.focusBlock

    if (focusedNode.type === 'table-cell') {
        const { value } = change
        if (value.endOffset != value.startText.text.length) return
        event.preventDefault()
        return true
    }
}

/**
   On return, do nothing if inside a table cell. If in something like instructions, a codeblock, or a choice, add another paragraph
*/
export function onEnter(event, change) {
    const focusedNode = change.value.focusBlock

    if (focusedNode.type === 'table-cell') {
        event.preventDefault()
        return true
    }

    // Codeblocks and choices
    if (focusedNode.type == 'codeblock' || focusedNode.type == 'choice' || 'instructions') {

        // TODO Look into enhancing this into a real paragraph
        change.insertText('\n')

    }

    event.preventDefault()
    return true
}

/**
   
*/
export function onShiftEnter(event, change) {
    const focusedNode = change.value.focusBlock
    let siblingNodeType = focusedNode.type

    if (focusedNode.type === 'table-cell') {
        if (focusedNode.type == 'codeblock') {
            siblingNodeType = 'paragraph'
        }

        change.insertBlock(Block.create({ type: siblingNodeType }))

        event.preventDefault()
        return true
    }
    else {
        if (focusedNode.type == 'codeblock') {
            siblingNodeType = 'paragraph'
        }

        change.insertBlock(Block.create({ type: siblingNodeType }))

        event.preventDefault()
        return true
    }
}

export function onCtrlEnter(event, change) {
    const focusedNode = change.value.focusBlock
    let parentQuestion = null

    if (focusedNode) {
        parentQuestion = findContainingQuestion(focusedNode, change.value)
        insertQuestion(change, parentQuestion)
    }

    event.preventDefault()
    return true
}

export function onShiftBackspace(event, change) {
    const focusedNode = change.value.focusBlock
    const test = change.value.document.nodes.get(0)
    let parentQuestion = null
    let parentChoice = null

    if (focusedNode) {
        parentQuestion = findContainingQuestion(focusedNode, change.value)

        parentQuestion.nodes.get(1).nodes.forEach(choice => {
            if (choice.key === focusedNode.key) {
                parentChoice = choice
            }
            else {
                choice.getBlocks().forEach(block => {
                    if (block.key === focusedNode.key) {
                        parentChoice = choice
                    }
                })
            }
        })

        if (parentQuestion.nodes.get(1).nodes.size > 1) {
            change.removeNodeByKey(parentChoice.key)
        }
    }

    event.preventDefault()
    return true
}

export function onCtrlBackspace(event, change) {
    const focusedNode = change.value.focusBlock
    const test = change.value.document.nodes.get(0)
    let parentQuestion = null

    if (focusedNode) {
        parentQuestion = findContainingQuestion(focusedNode, change.value)

        if (test.nodes.size > 1) {
            change.removeNodeByKey(parentQuestion.key)
        }
    }

    event.preventDefault()
    return true
}

export function onCtrlR(event, change) {
    const origText = window.prompt('Enter the text to replace:')
    const newText = window.prompt('Enter the new text:')
    if (!origText) return

    const value = change.value
    const isFragment = !value.fragment.isEmpty
    debugger;

    // Find each node that has that text
    value.document.getBlocks().forEach(block => {
        block.nodes.forEach(node => {
            if ((node.text.indexOf(origText) != -1 && node.kind === 'text') &&
                (!isFragment || (parseInt(node.key) >= parseInt(value.selection.anchorKey) &&
                                 parseInt(node.key) <= parseInt(value.selection.endKey)))) {
                change.removeTextByKey(node.key, node.text.indexOf(origText), origText.length)
                change.insertTextByKey(node.key, node.text.indexOf(origText), newText)
            }
        })
    })

    event.preventDefault()
    return
}

export function onCtrlI(event, change) {
    event.preventDefault()

    const value = change.value
    const selectionFrag = value.fragment
    if (selectionFrag.isEmpty) return

    const imageTextKey = value.focusBlock.key
    const url = selectionFrag.text
    const imageTextNode = value.document.getNode(imageTextKey)

    const newData = imageTextNode.data.set('src', url)
    const emptyNodes = Immutable.List([Text.create({ "text": " "})])
    const updatedImageNode = imageTextNode.set("type", "image").set("isVoid", true)
          .set("data", newData)
          .set('nodes', emptyNodes)

    imageTextNode.nodes.forEach(node => {
        if (node.text.indexOf(url) != -1 && node.kind === 'text') {
            change.removeTextByKey(node.key, node.text.indexOf(url), url.length)
        }
    })

    change.insertBlock(updatedImageNode)

    return
}
