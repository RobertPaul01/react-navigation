/* @flow */

import * as React from 'react';
import _ from 'lodash';

import clamp from 'clamp';
import {
  Animated,
  StyleSheet,
  PanResponder,
  Platform,
  View,
  I18nManager,
  Easing,
} from 'react-native';

import Card from './Card';
import NavigationActions from '../../NavigationActions';
import addNavigationHelpers from '../../addNavigationHelpers';
import CardSceneView from '../CardSceneView';

import TransitionConfigs from './TransitionConfigs';
import * as ReactNativeFeatures from '../../utils/ReactNativeFeatures';

const emptyFunction = () => {};

const theme = {
  white: '#FFFFFF',
  lightGrey: '#B7B7B7',
  primaryBlue: '#0074B4',
};

type Props = {
  headerMode: HeaderMode,
  headerComponent?: React.ComponentType<*>,
  mode: 'card' | 'modal',
  router: NavigationRouter<NavigationState, NavigationStackScreenOptions>,
  cardStyle?: ViewStyleProp,
  /**
   * Optional custom animation when transitioning between screens.
   */
  transitionConfig?: () => TransitionConfig,

  // NavigationTransitionProps:
  layout: NavigationLayout,
  scenes: Array<NavigationScene>,
  scene: NavigationScene,
  index: number,
  position: number,
  // True if FLIP_FORWARD or FLIP_BACKWARD and in progress
  isFlipTransition: boolean,
  // True during first half of a flip
  isFlipFrom: boolean,
  // True during second half of a flip
  isFlipTo: boolean,
  // True when animation is in progress
  isTransitioning: boolean,
  statusBarSize: number,
  openDrawer: Function,
  handleBackAction: Function,
};

type State = {
  headerHeight: number,
};

class CardStack extends React.Component<Props, State> {
  _screenDetails: {
    [key: string]: ?NavigationScreenDetails<NavigationStackScreenOptions>,
  } = {};

  constructor(props: Props) {
    super(props);
    this.state = {
      headerHeight: (props.isIOS ? 45 : 41) + props.statusBarSize,
    };
    // (this: any)._trackState = this._trackState.bind(this);
    (this: any)._hasSplitPaneComponent = this._hasSplitPaneComponent.bind(this);
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.statusBarSize !== this.props.statusBarSize) {
      this.setState({
        headerHeight: (this.props.isIOS ? 45 : 41) + this.props.statusBarSize,
      });
    }

    nextProps.scenes.forEach((newScene: *) => {
      if (
        this._screenDetails[newScene.key] &&
        this._screenDetails[newScene.key].state !== newScene.route
      ) {
        this._screenDetails[newScene.key] = null;
      }
    });
  }

  _hasSplitPaneComponent(scene) {
    return (
      this.props.isMultiPaneEligible === true &&
      scene.route.leftSplitPaneComponent != null
    );
  }

  _renderHeader(scene: NavigationScene, headerMode: HeaderMode): ?React.Node {
    // Caribou Start
    const accessibilityOption = this.props.hasModal
      ? 'no-hide-descendants'
      : 'yes';
    return (
      // $FlowFixMeRN0.51.1
      <this.props.headerComponent
        {...this.props}
        accessibilityOption={accessibilityOption}
        openDrawer={this.props.openDrawer}
        onNavigateBack={this.props.handleBackAction}
        scene={scene}
        mode={headerMode}
      />
    );
  }

  render() {
    let floatingHeader = null;
    const headerMode = this._getHeaderMode();

    const {
      scene,
      scenes,
      position,
      isFlipTransition,
      isFlipFrom,
      isFlipTo,
      isTransitioning,
    } = this.props;

    const {
      topVisibleScene,
      isHideTopScene,
      nonPurgedScenes,
    } = processFlipAnimation(
      scene,
      scenes,
      isFlipTransition,
      isFlipFrom,
      isFlipTo
    );

    if (headerMode === 'float') {
      floatingHeader = this._renderHeader(topVisibleScene, headerMode);
    }

    const containerStyle = [
      styles.container,
      this._getTransitionConfig().containerStyle,
    ];

    const { screenInterpolator } = this._getTransitionConfig(
      topVisibleScene.route.animateFromBottom
    );
    let flipAnimationStyle = {};
    if (isFlipTransition) {
      flipAnimationStyle =
        screenInterpolator && screenInterpolator({ ...this.props });
    }

    return (
      <Animated.View style={[containerStyle, flipAnimationStyle]}>
        <View style={styles.scenes}>
          {nonPurgedScenes.map((s: *, idx) => {
            const isTopScene = s.key === scene.key;
            const isTopVisibleScene = s.key === topVisibleScene.key;
            const shouldHide = isHideTopScene && isTopScene;
            return this._renderCard(s, {
              isTransitioning,
              isFlipTransition,
              shouldHide,
            });
          })}
        </View>
        {floatingHeader}
      </Animated.View>
    );
  }

  _getHeaderMode() {
    if (this.props.headerMode) {
      return this.props.headerMode;
    }
    if (this.props.mode === 'modal') {
      return 'screen';
    }
    return 'float';
  }

  _renderInnerScene(
    SceneComponent: NavigationComponent,
    scene: NavigationScene
  ): React.Node {
    const route: NavigationRoute = scene.route;

    const SplitPaneComponent = route.leftSplitPaneComponent;
    const hasSplitPaneComponent = this._hasSplitPaneComponent(scene);

    const paddingTop =
      route.hideNavBar || route.noNavBar ? 0 : this.state.headerHeight;
    const isActiveRoute = scene.isActive && !this.props.hasModal;

    return (
      <View
        style={{ flex: 1, backgroundColor: theme.white }}
        testID={`Screen_${scene.route.routeName}_${isActiveRoute
          ? 'IsActive'
          : 'IsNotActive'}`}
      >
        <View
          style={{
            height: paddingTop,
            backgroundColor: theme.primaryBlue,
          }}
        />
        <View style={{ flexDirection: 'row', flex: 1 }}>
          {hasSplitPaneComponent &&
            SplitPaneComponent && (
              <View
                style={{
                  width: 300,
                  borderRightWidth: 1,
                  borderColor: theme.lightGrey,
                }}
              >
                <CardSceneView
                  key={`SPLIT_PANE${route.key}`}
                  routeProps={scene.route}
                  component={SplitPaneComponent}
                  scene={scene}
                  handleNavigate={this.props.handleNavigate}
                  handleBack={this.props.handleBackAction}
                  trackingActions={this.props.trackingActions}
                  hasModal={this.props.hasModal}
                  isLeftSplitPaneComponent
                />
              </View>
            )}
          <View style={{ flex: 1 }}>
            <CardSceneView
              {...route}
              key={scene.key}
              routeKey={route.key}
              routeProps={scene.route}
              component={SceneComponent}
              scene={scene}
              handleNavigate={this.props.handleNavigate}
              handleBack={this.props.handleBackAction}
              trackingActions={this.props.trackingActions}
              hasModal={this.props.hasModal}
            />
          </View>
        </View>
      </View>
    );
  }

  _getTransitionConfig = isAnimateFromBottom => {
    const isModal = this.props.mode === 'modal';

    return TransitionConfigs.getTransitionConfig(
      this.props.transitionConfig,
      /* $FlowFixMe */
      {},
      /* $FlowFixMe */
      {},
      isModal || isAnimateFromBottom
    );
  };

  _renderCard = (scene: NavigationScene): React.Node => {
    const { screenInterpolator } = this._getTransitionConfig(
      scene.route.animateFromBottom
    );
    const style =
      screenInterpolator &&
      screenInterpolator({ ...this.props.transitionProps, scene });

    const SceneComponent = this.props.router.getComponentForRouteName(
      scene.route.routeName
    );

    const { transitionProps, ...props } = this.props;

    return (
      <Card
        {...props}
        {...transitionProps}
        key={`card_${scene.key}`}
        style={[style, this.props.cardStyle]}
        scene={scene}
      >
        {this._renderInnerScene(SceneComponent, scene)}
      </Card>
    );
  };
}

function processFlipAnimation(
  scene,
  scenes,
  isFlipTransition,
  isFlipFrom,
  isFlipTo
) {
  let nonPurgedScenes = scenes;
  let topVisibleScene = _.last(scenes);

  let isHideTopScene = false;
  if (isFlipTransition) {
    if (isFlipFrom) {
      // If flip from animation in progress, the top visible scene is actually
      // the previous route
      topVisibleScene = _.last(nonPurgedScenes.slice(0, -1));
      isHideTopScene = true;
    } else if (isFlipTo) {
      // Don't draw stale scenes after flip completes, ran into issue where
      // portal blue on bottom would draw behind bottom of flip and looked
      // weird
      nonPurgedScenes = nonPurgedScenes.filter(scene => !scene.route.isStale);
    }
  }
  // Never draw purged scenes, stale routes are purged once animation
  // completes TODO actually purge these from redux instead, after animation
  // looks good
  nonPurgedScenes = nonPurgedScenes.filter(scene => !scene.route.isPurged);

  return {
    topVisibleScene,
    isHideTopScene,
    nonPurgedScenes,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Header is physically rendered after scenes so that Header won't be
    // covered by the shadows of the scenes.
    // That said, we'd have use `flexDirection: 'column-reverse'` to move
    // Header above the scenes.
    flexDirection: 'column-reverse',
  },
  scenes: {
    flex: 1,
  },
});

export default CardStack;
