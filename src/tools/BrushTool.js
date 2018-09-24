import EVENTS from './../events.js';
import external from './../externalModules.js';
import BaseBrushTool from './../base/BaseBrushTool.js';
import toolColors from './../stateManagement/toolColors.js';
// Utils
import getCircle from './shared/brushUtils/getCircle.js';
import { drawBrushPixels } from './shared/brushUtils/drawBrush.js';
import isToolActive from '../tools/shared/isToolActive.js';
import KeyboardController from './shared/KeyboardController.js';
// State
import { getToolState, addToolState } from './../stateManagement/toolState.js';
import { getters } from './../store/index.js';
import store from '../store/index.js';

const brushState = store.modules.brush;
const cornerstone = external.cornerstone;

export default class BrushTool extends BaseBrushTool {
  constructor (name = 'Brush') {
    super({
      name,
      supportedInteractionTypes: ['mouse'],
      configuration: defaultBrushToolConfiguration()
    });
  }

  /**
  * Called by the event dispatcher to render the image.
  *
  * @param {Object} evt - The event.
  */
  renderBrush (evt) {
    const eventData = evt.detail;

    let mousePosition;

    if (this._drawing) {
      mousePosition = this._lastImageCoords;
    } else if (this._mouseUpRender) {
      mousePosition = this._lastImageCoords;
      this._mouseUpRender = false;
    } else {
      mousePosition = getters.mousePositionImage();
    }

    if (!mousePosition) {
      return;
    }

    const { rows, columns } = eventData.image;
    const { x, y } = mousePosition;

    if (x < 0 || x > columns ||
      y < 0 || y > rows) {
      return;
    }

    // Draw the hover overlay on top of the pixel data
    const configuration = this._configuration;
    const radius = brushState.getters.radius();
    const context = eventData.canvasContext;
    const element = eventData.element;
    const drawId = brushState.getters.draw();
    const color = this._getBrushColor(drawId);

    context.setTransform(1, 0, 0, 1, 0, 0);

    const { cornerstone } = external;
    const mouseCoordsCanvas = cornerstone.pixelToCanvas(element, mousePosition);
    const canvasTopLeft = cornerstone.pixelToCanvas(element, {
      x: 0,
      y: 0
    });
    const radiusCanvas = cornerstone.pixelToCanvas(element, {
      x: radius,
      y: 0
    });
    const circleRadius = Math.abs(radiusCanvas.x - canvasTopLeft.x);

    context.beginPath();
    context.strokeStyle = color;
    context.ellipse(mouseCoordsCanvas.x, mouseCoordsCanvas.y, circleRadius, circleRadius, 0, 0, 2 * Math.PI);
    context.stroke();
  }


  /**
   * Paints the data to the canvas.
   *
   * @private
   * @param  {Object} eventData The data object associated with the event.
   */
  _paint (eventData) {
    const configuration = this.configuration;
    const element = eventData.element;
    const { rows, columns } = eventData.image;
    const { x, y } = eventData.currentPoints.image;
    let toolData = getToolState(element, this.referencedToolData);

    let shouldErase = false;

    // Check for key, could be a mouseDown or mouseDrag event.
    if (this._isCtrlDown(eventData)) {
      console.log('ctrlDown');
      shouldErase = true;
    }

    const segmentationIndex = brushState.getters.draw();

    if (!toolData.data[segmentationIndex].pixelData) {
      console.log(`creating new pixelData for segmentation ${segmentationIndex}`);
      const newPixelData = new Uint8ClampedArray(eventData.image.width * eventData.image.height);
      toolData.data[segmentationIndex].pixelData = newPixelData;
    }

    const pixelData = toolData.data[segmentationIndex].pixelData;

    const radius = brushState.getters.radius();

    if (x < 0 || x > columns ||
      y < 0 || y > rows) {
      return;
    }

    const pointerArray = getCircle(radius, rows, columns, x, y);

    drawBrushPixels(pointerArray, pixelData, segmentationIndex, columns, shouldErase);

    toolData.data[segmentationIndex].invalidated = true;

    external.cornerstone.updateImage(eventData.element);
  }

  _isCtrlDown (eventData) {
    return (eventData.event && eventData.event.ctrlKey) || eventData.ctrlKey;
  }

}

function defaultBrushToolConfiguration () {
  return {
    keyBinds: {
      increaseBrushSize: '+',
      decreaseBrushSize: '-',
      nextSegmentation: ']',
      previousSegmentation: '['
    }
  };
}


/* Safari and Edge polyfill for createImageBitmap
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/createImageBitmap
 */

if (!('createImageBitmap' in window)) {
 window.createImageBitmap = async function (imageData) {
   return new Promise((resolve) => {
     const img = document.createElement('img');

     img.addEventListener('load', function () {

       resolve(this);
     });

     const conversionCanvas = document.createElement('canvas');

     conversionCanvas.width = imageData.width;
     conversionCanvas.height = imageData.height;

     const conversionCanvasContext = conversionCanvas.getContext('2d');

     conversionCanvasContext.putImageData(imageData, 0, 0, 0, 0, conversionCanvas.width, conversionCanvas.height);
     img.src = conversionCanvas.toDataURL();
   });
 };
}