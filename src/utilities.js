import { Value, State, Slate, Block, Text, Range, Data } from 'slate'

/**
   Returns the question that contains the given node.
*/
export function findContainingQuestion(node, state) {
    let containingQuestion = null

    state.document.nodes.get(0).nodes.forEach(question => {
        question.getBlocks().forEach(block => {
            if (block.key == node.key) {
                containingQuestion = question
            }
        })
    });

    return containingQuestion
}

/**
   Inserts a new question with 4 choices.
*/
export function insertQuestion(change, focusQuestion) {
    const instructions = Block.create({ type: "instructions" });
    const choice1 = Block.create({ type: "choice" });
    const choice2 = Block.create({ type: "choice" });
    const choice3 = Block.create({ type: "choice" });
    const choice4 = Block.create({ type: "choice" });

    const choices = Block.create({ type: "choices" }).update('nodes', nodes => nodes.push(choice1)).update('nodes', nodes => nodes.push(choice2)).
          update('nodes', nodes => nodes.push(choice3)).update('nodes', nodes => nodes.push(choice4))
    const block = Block.create({ type: "question" }).update('nodes', nodes => nodes.push(instructions)).update('nodes', nodes => nodes.push(choices))

    const questions = change.state.document.nodes.get(0).nodes
    let insertionIndex = 0

    questions.forEach((question, index) => {
        if (question.key === focusQuestion.key) {
            insertionIndex = index
        }
    })

    change.insertNodeByKey("2", insertionIndex + 1, block)
}
