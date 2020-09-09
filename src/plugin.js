import videojs from 'video.js';
import {version as VERSION} from '../package.json';
import ConcreteButton from './ConcreteButton';
import ConcreteMenuItem from './ConcreteMenuItem';

// Default options for the plugin.
const defaults = {};

// Cross-compatibility for Video.js 5 and 6.
const registerPlugin = videojs.registerPlugin || videojs.plugin;
// const dom = videojs.dom || videojs;

/**
 * VideoJS HLS Quality Selector Plugin class.
 */
class HlsQualitySelectorPlugin {

  /**
   * Plugin Constructor.
   *
   * @param {Player} player - The videojs player instance.
   * @param {Object} options - The plugin options.
   */
  constructor(player, options) {
    this.player = player;
    this.config = options;
    this.labelQualityLevel = this.config.labelQualityLevel || this.defaultLabelQualityLevel;
    this.isQualityHd = this.config.isQualityHd || this.defaultIsQualityHd;

    // If there is quality levels plugin and the HLS tech exists
    // then continue.
    if (this.player.qualityLevels && this.getHls()) {
      // Create the quality button.
      this.createQualityButton();
      this.bindPlayerEvents();
    }
  }

  defaultLabelQualityLevel(width, height) {
    return height + 'p';
  }

  defaultIsQualityHd(width, height) {
    return height >= 720;
  }

  /**
   * Returns HLS Plugin
   *
   * @return {*} - videojs-hls-contrib plugin.
   */
  getHls() {
    return this.player.tech({ IWillNotUseThisInPlugins: true }).hls;
  }

  /**
   * Binds listener for quality level changes.
   */
  bindPlayerEvents() {
    const qualityLevels = this.player.qualityLevels();

    qualityLevels.on('addqualitylevel', this.onAddQualityLevel.bind(this));
    qualityLevels.on('change', this.onChangeQualityLevel.bind(this));
  }

  /**
   * Adds the quality menu button to the player control bar.
   */
  createQualityButton() {

    const player = this.player;

    this._qualityButton = new ConcreteButton(player);

    const placementIndex = player.controlBar.children().length - 2;
    const concreteButtonInstance = player.controlBar.addChild(this._qualityButton,
      {componentClass: 'qualitySelector'},
      this.config.placementIndex || placementIndex);

    concreteButtonInstance.addClass('vjs-quality-selector');
    if (!this.config.displayCurrentQuality) {
      const icon = ` ${this.config.vjsIconClass || 'vjs-icon-hd'}`;

      concreteButtonInstance
        .menuButton_.$('.vjs-icon-placeholder').className += icon;
    } else {
      this.setButtonInnerText('auto');
    }
    concreteButtonInstance.removeClass('vjs-hidden');

  }

  /**
   *Set inner button text.
   *
   * @param {string} text - the text to display in the button.
   */
  setButtonInnerText(text) {
    this._qualityButton
      .menuButton_.$('.vjs-icon-placeholder').innerHTML = text;
  }

  /**
   * Builds individual quality menu items.
   *
   * @param {Object} item - Individual quality menu item.
   * @return {ConcreteMenuItem} - Menu item
   */
  getQualityMenuItem(item) {
    const player = this.player;

    return new ConcreteMenuItem(player, item, this._qualityButton, this);
  }

  /**
   * Executed when a quality level is added from HLS playlist.
   */
  onAddQualityLevel() {

    const player = this.player;
    const qualityList = player.qualityLevels();
    const levels = qualityList.levels_ || [];
    const levelItems = [];

    for (let i = 0; i < levels.length; ++i) {
      if (!levelItems.filter(_existingItem => {
        return _existingItem.item && _existingItem.item.value === levels[i].height;
      }).length) {
        const width = levels[i].width;
        const height = levels[i].height;

        const levelItem = this.getQualityMenuItem.call(this, {
          label: this.labelQualityLevel(width, height),
          value: levels[i].height
        });

        if (this.config.hdIconClass && this.isQualityHd(width, height)) {
          levelItem.addClass(this.config.hdIconClass);
        }

        levelItems.push(levelItem);
      }
    }

    levelItems.sort((current, next) => {
      if ((typeof current !== 'object') || (typeof next !== 'object')) {
        return -1;
      }
      if (current.item.value < next.item.value) {
        return this.config.invertQualityOrder ? 1 : -1;
      }
      if (current.item.value > next.item.value) {
        return this.config.invertQualityOrder ? -1 : 1;
      }
      return 0;
    });

    this._autoMenuItem = this.getQualityMenuItem.call(this, {
      label: 'testt',
      value: 'auto',
      selected: true
    });
    this.updateAutoLabel();
    levelItems.push(this._autoMenuItem);

    if (this._qualityButton) {
      this._qualityButton.createItems = function() {
        return levelItems;
      };
      this._qualityButton.update();
    }

  }

  updateAutoLabel() {
    if (!this._autoMenuItem) {
      return;
    }

    const qualityLevels = this.player.qualityLevels();
    const selectedLevel = qualityLevels[qualityLevels.selectedIndex];
    const autoLabel = this.player.localize('Auto');

    if (selectedLevel && this._autoMenuItem.isSelected_) {
      const qualityLabel = this.labelQualityLevel(selectedLevel.width, selectedLevel.height);

      this._autoMenuItem.el().innerText = `${autoLabel} (${qualityLabel})`;
    } else {
      this._autoMenuItem.el().innerText = autoLabel;
    }
  }

  updateQualityButtonHdIcon() {
    if (!this.config.hdIconClass) {
      return;
    }

    const qualityLevels = this.player.qualityLevels();
    const selectedLevel = qualityLevels[qualityLevels.selectedIndex];

    if (this.isQualityHd(selectedLevel.width, selectedLevel.height)) {
      this._qualityButton.addClass(this.config.hdIconClass);
    } else {
      this._qualityButton.removeClass(this.config.hdIconClass);
    }
  }

  onChangeQualityLevel() {
    this.updateQualityButtonHdIcon();
    this.updateAutoLabel();
  }

  /**
   * Sets quality (based on media height)
   *
   * @param {number} height - A number representing HLS playlist.
   */
  setQuality(height) {
    const qualityList = this.player.qualityLevels();

    if (this.config.displayCurrentQuality) {
      this.setButtonInnerText(height === 'auto' ? height : `${height}p`);
    }

    for (let i = 0; i < qualityList.length; ++i) {
      const quality = qualityList[i];

      quality.enabled = (quality.height === height || height === 'auto');
    }
    this.updateAutoLabel();
    this._qualityButton.unpressButton();
  }

}

/**
 * Function to invoke when the player is ready.
 *
 * This is a great place for your plugin to initialize itself. When this
 * function is called, the player will have its DOM and child components
 * in place.
 *
 * @function onPlayerReady
 * @param    {Player} player
 *           A Video.js player object.
 *
 * @param    {Object} [options={}]
 *           A plain object containing options for the plugin.
 */
const onPlayerReady = (player, options) => {
  player.addClass('vjs-hls-quality-selector');
  player.hlsQualitySelector = new HlsQualitySelectorPlugin(player, options);
};

/**
 * A video.js plugin.
 *
 * In the plugin function, the value of `this` is a video.js `Player`
 * instance. You cannot rely on the player being in a "ready" state here,
 * depending on how the plugin is invoked. This may or may not be important
 * to you; if not, remove the wait for "ready"!
 *
 * @function hlsQualitySelector
 * @param    {Object} [options={}]
 *           An object of options left to the plugin author to define.
 */
const hlsQualitySelector = function(options) {
  this.ready(() => {
    onPlayerReady(this, videojs.mergeOptions(defaults, options));
  });
};

// Register the plugin with video.js.
registerPlugin('hlsQualitySelector', hlsQualitySelector);

// Include the version number.
hlsQualitySelector.VERSION = VERSION;

export default hlsQualitySelector;
