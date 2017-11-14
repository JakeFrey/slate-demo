import React from 'react'
import ReactDOM from 'react-dom'

/**
 * The menu.
 *
 * @type {Component}
 */

class Menu extends React.Component {

    /**
     * Check if the current selection has a mark with `type` in it.
     *
     * @param {String} type
     * @return {Boolean}
     */

    hasMark(type) {
        const { value } = this.props
        return value.activeMarks.some(mark => mark.type == type)
    }

    /**
     * When a mark button is clicked, toggle the current mark.
     *
     * @param {Event} event
     * @param {String} type
     */

    onClickMark(event, type) {
        const { value, onChange } = this.props
        event.preventDefault()
        const change = value.change().toggleMark(type)
        onChange(change)
    }

    /**
     * Render a mark-toggling toolbar button.
     *
     * @param {String} type
     * @param {String} icon
     * @return {Element}
     */

    renderMarkButton(type, icon) {
        const isActive = this.hasMark(type)
        const onMouseDown = event => this.onClickMark(event, type)

        return (
                <span className="button" onMouseDown={onMouseDown} data-active={isActive}>
                <span className="material-icons">{icon}</span>
                </span>
        )
    }

    /**
     * Render.
     *
     * @return {Element}
     */

    render() {
        return (
            ReactDOM.createPortal(
                    <div className="menu hover-menu" ref={this.props.menuRef}>
                    <span className="button" onMouseDown={this.props.textToImage}>Show url</span>
                    </div>,
                root
            )
        )
    }
}

export default Menu;
