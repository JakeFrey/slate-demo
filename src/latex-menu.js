import React from 'react'
import ReactDOM from 'react-dom'

/**
 * The menu.
 *
 * @type {Component}
 */

class LatexMenu extends React.Component {
    /**
     * Render.
     *
     * @return {Element}
     */

    render() {
        return (
            ReactDOM.createPortal(
                    <div className="menu hover-menu" ref={this.props.menuRef}>
                    <span className="button" onMouseDown={this.props.textToLatex}>Return to latex</span>
                    </div>,
                root
            )
        )
    }
}

export default LatexMenu;
