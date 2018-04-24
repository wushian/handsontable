import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { hasOwnProperty } from './../../helpers/object';
import { rangeEach } from './../../helpers/number';
import { CellRange } from './../../3rdparty/walkontable/src';
import {arrayEach} from './../../helpers/array';
import { createHighlight } from './../../selection/highlight/types';
import * as C from './../../i18n/constants';
import {
  bottom,
  left,
  noBorders,
  right,
  top
} from './contextMenuItem';
import {
  createClassName,
  createDefaultCustomBorder,
  createSingleEmptyBorder,
  createEmptyBorders,
  extendDefaultBorder
} from './utils';

export const CUSTOM_SELECTION = 'custom-selection';
/**
 * @plugin CustomBorders
 *
 * @description
 * This plugin enables an option to apply custom borders through the context menu (configurable with context menu key `borders`).
 *
 * To initialize Handsontable with predefined custom borders, provide cell coordinates and border styles in a form of an array.
 *
 * See [Custom Borders](http://docs.handsontable.com/demo-custom-borders.html) demo for more examples.
 *
 * @example
 * ```js
 * ...
 * customBorders: [
 *   {
 *    range: {
 *      from: {
 *        row: 1,
 *        col: 1
 *      },
 *      to: {
 *        row: 3,
 *        col: 4
 *      },
 *    },
 *    left: {},
 *    right: {},
 *    top: {},
 *    bottom: {},
 *   },
 * ],
 * ...
 *
 * // or
 * ...
 * customBorders: [
 *   { row: 2,
 *     col: 2,
 *     left: {
 *       width: 2,
 *       color: 'red',
 *     },
 *     right: {
 *       width: 1,
 *       color: 'green',
 *     },
 *     top: '',
 *     bottom: '',
 *   }
 * ],
 * ...
 * ```
 * @private
 * @class CustomBorders
 */
class CustomBorders extends BasePlugin {
  constructor(hotInstance) {
    super(hotInstance);

    /**
     * Saved borders.
     *
     * @type {Array}
     */
    this.savedBorders = [];
  }

  /**
   * Check if the plugin is enabled in the handsontable settings.
   *
   * @returns {Boolean}
   */
  isEnabled() {
    return !!this.hot.getSettings().customBorders;
  }

  /**
   * Enable plugin for this Handsontable instance.
   */
  enablePlugin() {
    if (this.enabled) {
      return;
    }

    this.addHook('afterContextMenuDefaultOptions', (options) => this.onAfterContextMenuDefaultOptions(options));
    this.addHook('afterInit', () => this.onAfterInit());

    super.enablePlugin();
  }

  /**
   * Disable plugin for this Handsontable instance.
   */
  disablePlugin() {
    this.clearBorders();

    super.disablePlugin();
  }

  /**
   * Updates the plugin to use the latest options you have specified.
   */
  updatePlugin() {
    this.disablePlugin();
    this.enablePlugin();

    this.changeBorderSettings();

    super.updatePlugin();
  }

  /**
   * Insert WalkontableSelection instance into Walkontable settings.
   *
   * @param {Object} border Object with `row` and `col`, `left`, `right`, `top` and `bottom`, `className` and `border` ({Object} with `color`, `width` and `cornerVisible` property) properties.
   */
  insertBorderIntoSettings(border) {
    this.savedBorders.push(border);

    this.savedBorders = this.savedBorders.filter((obj, index, array) => array.map((mapObj) => mapObj.className).indexOf(obj.className) === index);

    const coordinates = {
      row: border.row,
      col: border.col
    };
    const cellRange = new CellRange(coordinates, coordinates, coordinates);
    const selection = createHighlight(CUSTOM_SELECTION, {border, cellRange});

    if (!this.hot.selection.highlight.customSelection.includes(selection)) {
      this.hot.selection.highlight.setCustomSelection(selection);
    }
  }

  /**
   * Prepare borders from setting (single cell).
   *
   * @param {Number} row Visual row index.
   * @param {Number} col Visual column index.
   * @param {Object} borderObj Object with `row` and `col`, `left`, `right`, `top` and `bottom` properties.
   */
  prepareBorderFromCustomAdded(row, col, borderObj) {
    let border = createEmptyBorders(row, col);

    border = extendDefaultBorder(border, borderObj);
    this.hot.setCellMeta(row, col, 'borders', border);

    this.insertBorderIntoSettings(border);
  }

  /** *
   * Prepare borders from setting (object).
   *
   * @param {Object} rowObj Object with `range`, `left`, `right`, `top` and `bottom` properties.
   */
  prepareBorderFromCustomAddedRange(rowObj) {
    let range = rowObj.range;

    rangeEach(range.from.row, range.to.row, (rowIndex) => {
      rangeEach(range.from.col, range.to.col, (colIndex) => {
        let border = createEmptyBorders(rowIndex, colIndex);
        let add = 0;

        if (rowIndex === range.from.row) {
          add += 1;

          if (hasOwnProperty(rowObj, 'top')) {
            border.top = rowObj.top;
          }
        }

        if (rowIndex === range.to.row) {
          add += 1;

          if (hasOwnProperty(rowObj, 'bottom')) {
            border.bottom = rowObj.bottom;
          }
        }

        if (colIndex === range.from.col) {
          add += 1;

          if (hasOwnProperty(rowObj, 'left')) {
            border.left = rowObj.left;
          }
        }

        if (colIndex === range.to.col) {
          add += 1;

          if (hasOwnProperty(rowObj, 'right')) {
            border.right = rowObj.right;
          }
        }

        if (add > 0) {
          this.hot.setCellMeta(rowIndex, colIndex, 'borders', border);
          this.insertBorderIntoSettings(border);
        }
      });
    });
  }

  /**
   * Remove borders divs from DOM.
   *
   * @param {String} borderClassName Border class name as string.
   */
  removeBordersFromDom(borderClassName) {
    let borders = this.hot.rootElement.querySelectorAll(`.${borderClassName}:not(td)`);

    rangeEach(0, borders.length - 1, (index) => {
      let parent = borders[index].parentNode;

      if (parent.parentNode) {
        parent.parentNode.removeChild(parent);
      }
    });

    this.removeClassBorderFromTDs(borderClassName);
  }

  /**
   * Remove class border from TDs.
   *
   * @param {String} borderClassName Border class name as string.
   */
  removeClassBorderFromTDs(borderClassName) {
    arrayEach(this.hot.selection.highlight.customSelection, (selection, index) => {
      if (selection.settings.className === borderClassName) {
        this.hot.selection.highlight.customSelection.splice(index, 1);

        return false; // breaks forAll
      }
    });

    this.hot.render();
  }

  /**
   * Remove border (triggered from context menu).
   *
   * @param {Number} row Visual row index.
   * @param {Number} col Visual column index.
   */
  removeAllBorders(row, col) {
    let borderClassName = createClassName(row, col);
    let index = this.savedBorders.map((obj) => obj.className).indexOf(borderClassName);

    this.savedBorders.splice(index, 1);

    this.removeBordersFromDom(borderClassName);
    this.hot.removeCellMeta(row, col, 'borders');
  }

  /**
   * Set borders for each cell re. to border position.
   *
   * @param {Number} row Visual row index.
   * @param {Number} col Visual column index.
   * @param {String} place Coordinate where add/remove border - `top`, `bottom`, `left`, `right` and `noBorders`.
   * @param {Boolean} remove True when remove borders, and false when add borders.
   */
  setBorder(row, col, place, remove) {
    let bordersMeta = this.hot.getCellMeta(row, col).borders;

    if (!bordersMeta || bordersMeta.border === void 0) {
      bordersMeta = createEmptyBorders(row, col);
    }

    if (remove) {
      bordersMeta[place] = createSingleEmptyBorder();
    } else {
      bordersMeta[place] = createDefaultCustomBorder();
    }

    this.hot.setCellMeta(row, col, 'borders', bordersMeta);

    let borderClassName = createClassName(row, col);
    this.removeBordersFromDom(borderClassName);
    this.insertBorderIntoSettings(bordersMeta);

    this.hot.render();
  }

  /**
   * Prepare borders based on cell and border position.
   *
   * @param {Object} selected
   * @param {String} place Coordinate where add/remove border - `top`, `bottom`, `left`, `right` and `noBorders`.
   * @param {Boolean} remove True when remove borders, and false when add borders.
   */
  prepareBorder(selected, place, remove) {
    arrayEach(selected, ({start, end}) => {
      if (start.row === end.row && start.col === end.col) {
        if (place === 'noBorders') {
          this.removeAllBorders(start.row, start.col);
        } else {
          this.setBorder(start.row, start.col, place, remove);
        }

      } else {
        switch (place) {
          case 'noBorders':
            rangeEach(start.col, end.col, (colIndex) => {
              rangeEach(start.row, end.row, (rowIndex) => {
                this.removeAllBorders(rowIndex, colIndex);
              });
            });
            break;

          case 'top':
            rangeEach(start.col, end.col, (topCol) => {
              this.setBorder(start.row, topCol, place, remove);
            });
            break;

          case 'right':
            rangeEach(start.row, end.row, (rowRight) => {
              this.setBorder(rowRight, end.col, place, remove);
            });
            break;

          case 'bottom':
            rangeEach(start.col, end.col, (bottomCol) => {
              this.setBorder(end.row, bottomCol, place, remove);
            });
            break;

          case 'left':
            rangeEach(start.row, end.row, (rowLeft) => {
              this.setBorder(rowLeft, start.col, place, remove);
            });
            break;
          default:
            break;
        }
      }
    });
  }

  /**
   * Create borders from settings.
   *
   * @private
   * @param {Array} customBorders Object with `row` and `col`, `left`, `right`, `top` and `bottom` properties.
   */
  createCustomBorders(customBorders) {
    rangeEach(0, customBorders.length - 1, (index) => {
      if (customBorders[index].range) {
        this.prepareBorderFromCustomAddedRange(customBorders[index]);

      } else {
        this.prepareBorderFromCustomAdded(customBorders[index].row, customBorders[index].col, customBorders[index]);
      }
    });

    this.hot.render();
    this.hot.view.wt.draw(true);
  }

  /**
   * Add border options to context menu.
   *
   * @private
   * @param {Object} defaultOptions Context menu items.
   */
  onAfterContextMenuDefaultOptions(defaultOptions) {
    if (!this.hot.getSettings().customBorders) {
      return;
    }

    defaultOptions.items.push({
      name: '---------',
    }, {
      key: 'borders',
      name() {
        return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_BORDERS);
      },
      disabled() {
        return this.selection.isSelectedByCorner();
      },
      submenu: {
        items: [
          top(this),
          right(this),
          bottom(this),
          left(this),
          noBorders(this)
        ]
      }
    });
  }

  /**
    * Clear borders.
    *
    * @private
    */
  clearBorders() {
    rangeEach(0, this.savedBorders.length - 1, (index) => {
      let borderClassName = this.savedBorders[index].className;

      this.removeBordersFromDom(borderClassName);
    });
  }

  /**
   * Change borders from settings.
   *
   * @private
   */
  changeBorderSettings() {
    let customBorders = this.hot.getSettings().customBorders;

    if (Array.isArray(customBorders)) {
      if (!customBorders.length) {
        this.savedBorders = customBorders;
      }

      this.createCustomBorders(customBorders);

    } else if (customBorders !== void 0) {
      this.createCustomBorders(this.savedBorders);
    }
  }

  /**
   * `afterInit` hook callback.
   *
   * @private
   */
  onAfterInit() {
    this.changeBorderSettings();
  }

  /**
   * Destroy plugin instance.
   */
  destroy() {
    super.destroy();
  }
}

registerPlugin('customBorders', CustomBorders);

export default CustomBorders;
