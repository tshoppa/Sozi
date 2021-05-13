/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/** @module */

import {Frame} from "../model/Presentation";
import {EventEmitter} from "events";

/** The zoom step factor for user zoom action (keyboard and mouse wheel)
 *
 * @readonly
 * @default
 * @type {number} */
const SCALE_FACTOR = 1.05;

/** The rotation step angle for user zoom action (keyboard and mouse wheel), in degrees.
 *
 * @readonly
 * @default
 * @type {number} */
const ROTATE_STEP = 5;

/** The mouse button for the drag action.
 *
 * 0 is the left button.
 *
 * @readonly
 * @default
 * @type {number} */
const DRAG_BUTTON = 0;

/** The minimum distance to detect a drag action, in pixels.
 *
 * @readonly
 * @default
 * @type {number} */
const DRAG_THRESHOLD_PX = 5;

/** The delay after the last mouse wheel event to consider that the wheel action is terminated, in milliseconds.
 *
 * @readonly
 * @default
 * @type {number} */
const WHEEL_TIMEOUT_MS = 200;

/** Signals a mouse click in a viewport.
 *
 * @event module:player/Viewport.click
 */

/** Signals a mouse button press in a viewport.
 *
 * @event module:player/Viewport.mouseDown
 */

/** Signals the possible start of a drag gesture in a viewport.
 *
 * @event module:player/Viewport.dragStart
 */

/** Signals the end of a drag gesture in a viewport.
 *
 * @event module:player/Viewport.dragEnd
 */

/** Signals a user-activated change in the camera states of a viewport.
 *
 * @event module:player/Viewport.userChangeState
 */

/** Signals that an user interaction triggered a change to the player's state.
 *
 * @event module:player/Player.localChange
 */

/** the event handling controller for all entities in the player's context.
 * The controller implements keyboard and mouse handlers and performs according actions on the associated player. 
 * It also provides an interface to external ui event handlers:
 * - TouchGestures
 * - presentation console
 *
 * @extends EventEmitter
 */
export class UIController extends EventEmitter {
    /** Initialize a new Sozi player controller.
     *
     * If the presentation is opened in edit mode, the controller will disable
     * these features on the corresponding player:
     * - mouse and keyboard actions for navigating in the presentation,
     * - automatic transitions after a timeout.
     *
     * @param {module:player/Player.Player} player - The corresponindg player.
     * @param {module:player/Viewport.Viewport} viewport - The viewport where the presentation is rendered.
     * @param {module:model/Presentation.Presentation} presentation - The presentation to play.
     * @param {boolean} [editMode=false] - Is the presentation opened in edit mode?
     */

    constructor(player, editMode){
        super();
        
        /** The observed player.
         *
         * @type {module:player/Player.Player} */
        this.player = player;

        /** The observed viewport.
         *
         * @type {module:model/Viewport.Viewport} */
        this.viewport = player.viewport;

        /** The documents root element.
         *
         * @type {} */
        this.svgRoot = this.viewport.svgRoot;

        /** The presentations to display.
         *
         * @type {module:model/Presentation.Presentation} */
        this.presentation = player.presentation;

        /** Is the presentation opened in an editor?
         *
         * @type {boolean} */
        this.editMode = !!editMode;
        
        /** The current X coordinate of the mous during a drag action.
         *
         * @default
         * @type {number} */
        this.mouseDragX = 0;

        /** The current Y coordinate of the mous during a drag action.
         *
         * @default
         * @type {number} */
        this.mouseDragY = 0;
        
        /** A timeout ID to detect the end of a mouse wheel gesture.
         *
         * @default
         * @type {?number} */
        this.wheelTimeout = null;
        
        /** The mouse drag event handler.
         *
         * This function is registered as an event listener after
         * a mouse-down event.
         *
         * @param {MouseEvent} evt - A DOM event.
         * @returns {void}
         * @listens mousemove
         */
        this.dragHandler = evt => this.onDrag(evt);

        /** The mouse drag end event handler.
         *
         * This function is registered as an event listener after
         * a mouse-down event.
         *
         * @param {MouseEvent} evt - A DOM event.
         * @returns {void}
         * @listens mouseup
         */
        this.dragEndHandler = evt => this.onDragEnd(evt);

        
        this.svgRoot.addEventListener("mousedown", evt => this.onMouseDown(evt), false);
        this.svgRoot.addEventListener("mousemove", evt => this.onMouseMove(evt), false);
        this.svgRoot.addEventListener("contextmenu", evt => this.onContextMenu(evt), false);
        
        const wheelEvent =
            "onwheel" in document.createElement("div") ? "wheel" :  // Modern browsers support "wheel"
            document.onmousewheel !== undefined ? "mousewheel" :    // Webkit and IE support at least "mousewheel"
            "DOMMouseScroll";                                       // Firefox < 17
        this.svgRoot.addEventListener(wheelEvent, evt => this.onWheel(evt), false);
        
        
        if (!editMode) {
            this.viewport.on("click", btn => this.onClick(btn));
            window.addEventListener("keydown", evt => this.onKeyDown(evt), false);
                
            if (this.presentation.enableMouseTranslation) {
                this.viewport.on("dragStart", () => this.player.pause());
            }
            
            this.viewport.on("userChangeState", () => player.pause());
            window.addEventListener("keypress", evt => this.onKeyPress(evt), false);
        }
    }
    
        /** Process a mouse move event in this viewport.
     *
     * @param {MouseEvent} evt - A DOM event.
     *
     * @listens mousemove
     */
    onMouseMove(evt) {
        this.viewport.updateClipCursor(evt.clientX,evt.clientY);            
    }

    /** Process a mouse down event in this viewport.
     *
     * If the mouse button pressed is the left button,
     * this method will setup event listeners for detecting a drag action.
     *
     * @param {MouseEvent} evt - A DOM event.
     *
     * @listens mousedown
     * @fires module:player/Viewport.mouseDown
     */
    onMouseDown(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        if (evt.button === DRAG_BUTTON) {
            this.mouseDragged = false;
            this.mouseDragChangedState = false;
            this.mouseDragX = this.mouseDragStartX = evt.clientX;
            this.mouseDragY = this.mouseDragStartY = evt.clientY;

            document.documentElement.addEventListener("mousemove", this.dragHandler, false);
            document.documentElement.addEventListener("mouseup", this.dragEndHandler, false);
            
            
            this.viewport.updateClipMode(evt.clientX,evt.clientY);

        }        

        this.emit("mouseDown", evt.button);
    }
    
    /** Process a mouse drag event.
     *
     * This method is called when a mouse move event happens after a mouse down event.
     *
     * @param {MouseEvent} evt - A DOM event.
     *
     * @listens mousemove
     * @fires module:player/Viewport.dragStart
     */
    onDrag(evt) {
        evt.stopPropagation();
        const xFromCenter = evt.clientX - this.viewport.x - this.viewport.width / 2;
        const yFromCenter = evt.clientY - this.viewport.y - this.viewport.height / 2;
        let angle = 180 * Math.atan2(yFromCenter, xFromCenter) / Math.PI;
        let translateX = evt.clientX;
        let translateY = evt.clientY;
        const zoom = Math.sqrt(xFromCenter * xFromCenter + yFromCenter * yFromCenter);
        const deltaX = evt.clientX - this.mouseDragX;
        const deltaY = evt.clientY - this.mouseDragY;

        // The drag action is confirmed when one of the mouse coordinates
        // has moved past the threshold
        if (!this.mouseDragged && (Math.abs(deltaX) > DRAG_THRESHOLD_PX ||
                                   Math.abs(deltaY) > DRAG_THRESHOLD_PX)) {
            this.mouseDragged = true;

            this.rotateStart = this.rotatePrev = angle;
            this.translateStartX = this.translateXPrev = translateX;
            this.translateStartY = this.translateYPrev = translateY;
            this.zoomPrev = zoom;

            this.emit("dragStart");
        }

        if (this.mouseDragged) {
            let mode = this.viewport.dragMode;
            if (mode == "translate") {
                if (evt.altKey) {
                    mode = "scale";
                }
                else if (evt.shiftKey) {
                    mode = "rotate";
                }
            }

            switch (mode) {
                case "scale":
                    if (this.editMode || this.presentation.enableMouseZoom) {
                        if (this.zoomPrev !== 0) {
                            this.zoomDefault(zoom / this.zoomPrev);
                            this.mouseDragChangedState = true;
                        }
                        this.zoomPrev = zoom;
                    }
                    break;

                case "rotate":
                    if (this.editMode || this.presentation.enableMouseRotation) {
                        if (evt.ctrlKey) {
                            angle = 10 * Math.round((angle - this.rotateStart) / 10) + this.rotateStart;
                        }
                        this.rotate(this.rotatePrev - angle);
                        this.mouseDragChangedState = true;
                        this.rotatePrev = angle;
                    }
                    break;

                case "clip":
                    this.viewport.clipByMode(this.mouseDragStartX - this.viewport.x, this.mouseDragStartY - this.viewport.y,
                                             this.mouseDragX      - this.viewport.x, this.mouseDragY      - this.viewport.y,
                                             deltaX, deltaY);

                    this.mouseDragChangedState = true;
                    break;

                default: // case "translate":
                    if (this.editMode || this.presentation.enableMouseTranslation) {
                        if (evt.ctrlKey) {
                            if (Math.abs(translateX - this.translateStartX) >= Math.abs(translateY - this.translateStartY)) {
                                translateY = this.translateStartY;
                            }
                            else {
                                translateX = this.translateStartX;
                            }
                        }
                        this.translate(translateX - this.translateXPrev, translateY - this.translateYPrev);
                        this.mouseDragChangedState = true;
                        this.translateXPrev = translateX;
                        this.translateYPrev = translateY;
                    }
            }
            this.mouseDragX = evt.clientX;
            this.mouseDragY = evt.clientY;
        }
    }

    /** Process a drag end event.
     *
     * This method is called when a mouse up event happens after a mouse down event.
     * If the mouse has been moved past the drag threshold, this method
     * will fire a `dragEnd` event. Otherwise, it will fire a `click` event.
     *
     * @param {MouseEvent} evt - A DOM event
     *
     * @listens mouseup
     * @fires module:player/Viewport.userChangeState
     * @fires module:player/Viewport.dragEnd
     * @fires module:player/Viewport.click
     */
    onDragEnd(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        if (evt.button === DRAG_BUTTON) {
            if (this.mouseDragged) {
                this.emit("dragEnd");
                if (this.mouseDragChangedState) {
                    this.emit("userChangeState");
                }
            }
            else {
                this.viewport.emit("click", evt.button, evt);
            }

            document.documentElement.removeEventListener("mousemove", this.dragHandler, false);
            document.documentElement.removeEventListener("mouseup", this.dragEndHandler, false);
        }
        else {
            this.viewport.emit("click", evt.button, evt);
        }
    }

    /** Process a mouse wheel event in this viewport.
     *
     * The effect of the mouse wheel depends on the state of the Shift key:
     *    - released: zoom in and out,
     *    - pressed: rotate clockwise or counter-clockwise
     *
     * @param {WheelEvent} evt - A DOM event.
     *
     * @fires module:player/Viewport.userChangeState
     */
    onWheel(evt) {
        if (this.wheelTimeout !== null) {
            window.clearTimeout(this.wheelTimeout);
        }

        evt.stopPropagation();
        evt.preventDefault();

        let delta = 0;
        if (evt.wheelDelta) {   // "mousewheel" event
            delta = evt.wheelDelta;
        }
        else if (evt.detail) {  // "DOMMouseScroll" event
            delta = -evt.detail;
        }
        else {                  // "wheel" event
            delta = -evt.deltaY;
        }

        let changed = false;

        if (delta !== 0) {
            if (evt.shiftKey) {
                // TODO rotate around mouse cursor
                if (this.editMode || this.presentation.enableMouseRotation) {
                    this.rotate(delta > 0 ? ROTATE_STEP : -ROTATE_STEP);
                    changed = true;
                }
            }
            else {
                if (this.editMode || this.presentation.enableMouseZoom) {
                    this.zoom(delta > 0 ? SCALE_FACTOR : 1/SCALE_FACTOR, evt.clientX - this.viewport.x, evt.clientY - this.viewport.y);
                    changed = true;
                }
            }
        }

        if (changed) {
            this.wheelTimeout = window.setTimeout(() => {
                this.wheelTimeout = null;
                this.emit("userChangeState");
            }, WHEEL_TIMEOUT_MS);
        }
    }
    
        
    /** Process a right-click in the associated viewport.
     *
     * This method forwards the `contextmenu` event as a
     * viewport {@linkcode module:player/Viewport.click|click} event.
     *
     * @param {MouseEvent} evt - A DOM event.
     *
     * @listens contextmenu
     * @fires module:player/Viewport.click
     */
    onContextMenu(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        this.viewport.emit("click", 2, evt);
    }
    
    /** Move to the next or previous frame on each click event in the viewport.
     *
     * This method is registered as a {@linkcode module:player/Viewport.click|click}
     * event handler of the current {@linkcode module:player/Viewport.Viewport|viewport}.
     *
     * @param {number} button - The index of the button that was pressed.
     *
     * @listens module:player/Viewport.click
     */
    onClick(button) {
        if (this.presentation.enableMouseNavigation) {
            switch (button) {
                case 0: this.moveToNext(); break;
                case 2: this.moveToPrevious(); break;
            }
        }
    }

    /** Process a keyboard event.
     *
     * This method handles the navigation keys if they are enabled in the
     * current presentation:
     * Arrows, Page-Up/Down, Home, End, Enter, and Space.
     *
     * @param {KeyboardEvent} evt - The DOM event to process.
     *
     * @listens keydown
     */
    onKeyDown(evt) {
        // Keys with Alt/Ctrl/Meta modifiers are ignored
        if (evt.altKey || evt.ctrlKey || evt.metaKey) {
            return;
        }

        switch (evt.keyCode) {
            case 36: // Home
                if (this.presentation.enableKeyboardNavigation) {
                    if (evt.shiftKey) {
                        this.jumpToFirst();
                    }
                    else {
                        this.moveToFirst();
                    }
                }
                break;

            case 35: // End
                if (this.presentation.enableKeyboardNavigation) {
                    if (evt.shiftKey) {
                        this.jumpToLast();
                    }
                    else {
                        this.moveToLast();
                    }
                }
                break;

            case 38: // Arrow up
            case 33: // Page up
            case 37: // Arrow left
                if (this.presentation.enableKeyboardNavigation) {
                    if (evt.shiftKey) {
                        this.jumpToPrevious();
                    }
                    else {
                        this.moveToPrevious();
                    }
                }
                break;

            case 40: // Arrow down
            case 34: // Page down
            case 39: // Arrow right
            case 13: // Enter
            case 32: // Space
                if (this.presentation.enableKeyboardNavigation) {
                    if (evt.shiftKey) {
                        this.jumpToNext();
                    }
                    else {
                        this.moveToNext();
                    }
                }
                break;

            default:
                return;
        }

        evt.stopPropagation();
        evt.preventDefault();
    }

    /** Process a keyboard event.
     *
     * This method handles character keys: "+", "-", "R", "P", ".".
     *
     * @param {KeyboardEvent} evt - The DOM event to process.
     *
     * @listens keypress
     */
    onKeyPress(evt) {
        // Keys with modifiers are ignored
        if (evt.altKey || evt.ctrlKey || evt.metaKey) {
            return;
        }

        switch (evt.charCode || evt.which) {
            case 43: // +
                if (this.presentation.enableKeyboardZoom) {
                    this.zoomDefault(SCALE_FACTOR);
                }
                break;

            case 45: // -
                if (this.presentation.enableKeyboardZoom) {
                    this.zoomDefault(1 / SCALE_FACTOR);
                }
                break;

            case 82: // R
                if (this.presentation.enableKeyboardRotation) {
                    this.rotate(-ROTATE_STEP);
                }
                break;

            case 114: // r
                if (this.presentation.enableKeyboardRotation) {
                    this.viewport.rotate(ROTATE_STEP);
                    this.pause();
                }
                break;

            case 80: // P
            case 112: //p
                this.togglePause();
                break;

            case 46: // .
                if (this.presentation.enableKeyboardNavigation) {
                    this.toggleBlankScreen();
                }
                break;

            default:
                return;
        }

        evt.stopPropagation();
        evt.preventDefault();
    }
    
    /** The index of the presentation's last frame
     *
     * @readonly
     * @type {number}
     */
    get lastFrame(){
        return this.player.presentation.frames.length - 1;
    }
    
    /** Jumps to the first frame of the presentation.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     */
    jumpToFirst() {
        this.jumpToFrame(0);
    }

    /** Jump to the last frame of the presentation.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     */
    jumpToLast() {
        this.jumpToFrame(this.lastFrame);
    }

    /** Jump to the previous frame.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     */
    jumpToPrevious() {
        this.jumpToFrame(this.player.previousFrame);
    }

    /** Jumps to the next frame.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     */
    jumpToNext() {
        this.jumpToFrame(this.player.nextFrame);
    }
    
    /** Move to the first frame of the presentation.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     * @fires {module:player/Player.stateChange}
     */
    moveToFirst() {
        this.moveToFrame(0);
    }


    /** Move to the previous frame.
     *
     * This method skips previous frames with 0 ms timeout.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     * @fires {module:player/Player.stateChange}
     */
    moveToPrevious() {
        const frame = this.player.lastNonAutoTransitionFrame();
        if (frame != null ) this.moveToFrame(frame);        
    }
    
    /** Move to the next frame.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     * @fires {module:player/Player.stateChange}
     */
    moveToNext() {
        this.emit("localChange", {change:"moveToFrame", value:this.player.nextFrame});
        this.player.moveToNext();
    }
    
    /** Move to the last frame of the presentation.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     * @fires {module:player/Player.stateChange}
     */
    moveToLast() {
        this.moveToFrame(this.lastFrame);
    }
    
    /** Move to a frame in *preview* mode.
     *
     * @param {string|number|module:model/Presentation.Frame} frame - The frame to show.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     * @fires {module:player/Player.stateChange}
     */
    previewFrame(frame) {
        let f = this.player.findFrame(f);
        this.emit("localChange", {change:"previewFrame", value:f});
        this.player.previewFrame(f);
    }
    
    /** Jump to the given frame of the presentation and signal a local change.
     *
     * @param {string|number|module:model/Presentation.Frame} frame - The frame to show.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     * @fires {module:player/Player.stateChange}
     */
    jumpToFrame(frame){
        let f = this.player.findFrame(frame);
        this.emit("localChange", {change:"jumpToFrame", value:f});
        this.player.jumpToFrame(f);
    }  

    /** Move to the given frame of the presentation and signal a local change.
     *
     * @param {string|number|module:model/Presentation.Frame} frame - The frame to show.
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.frameChange}
     * @fires {module:player/Player.stateChange}
     */
    moveToFrame(frame){
        let f = this.player.findFrame(frame);
        this.emit("localChange", {change:"moveToFrame", value:f});
        this.player.moveToFrame(f);
    }  
    
        
     
     
    /** helper for translation by x and y offset.
     *
     * @param {number} deltaX - The horizontal displacement, in pixels.
     * @param {number} deltaY - The vertical displacement, in pixels.
     *
     * @fires {module:player/Player.localChange}
     */
     translate(deltaX, deltaY){
        this.emit("localChange", {change: "interactive"});
        this.viewport.translate(deltaX, deltaY);
    }


    /** rotation clockwise as well as counter clockwise.
     *
     * @param {number} angle - The rotation angle, in degrees.
     *
     * @fires {module:player/Player.localChange}
     *
     */
    rotate(angle){
        this.player.pause();
        this.emit("localChange", {change: "interactive"});
        this.viewport.rotate(angle);
    }    

    /** zoom in as well as out focusing a default center coordinate
     *    
     * @param {number} factor - The scaling factor, above 1 to zoom in, below 1 to zoom out.
     *
     * @fires {module:player/Player.localChange}
     */
    zoomDefault(factor){
        this.zoom(factor, this.viewport.width / 2, this.viewport.height / 2);
    }
    
    /** zoom in as well as out
     *    
     * @param {number} factor - The scaling factor, above 1 to zoom in, below 1 to zoom out.
     * @param {number} x - The x coordinate of the center point to focus while zooming.
     * @param {number} y - The y coordinate of the center point to focus while zooming..
     *
     * @fires {module:player/Player.localChange}
     */
    zoom(factor, x, y){
        this.player.pause();
        this.emit("localChange", {change: "interactive"});
        this.viewport.zoom(factor, x,y);
    }
        
    /** toggles the pause state of the associated player
     *
     * @fires {module:player/Player.localChange}
     * @fires {module:player/Player.stateChange}
     */
    togglePause(){
        if (this.player.playing) {
            this.player.pause();
        }
        else {
            this.player.playFromFrame(this.player.currentFrame);
        }
        
        this.emit("localChange", {change:"pause"});
    }
    
    /** Toggle the visibility of the elements that hides the viewport. 
     * 
     * @fires {module:player/Player.localChange}
     */
    toggleBlankScreen() {
        if (this.player.blankScreenIsVisible) {
            this.player.disableBlankScreen();
        }
        else {
            this.player.enableBlankScreen();
        }
        this.emit("localChange", {change:"blankScreen", value:this.player.blankScreenIsVisible});
    }            
}