import React from 'react';

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
}

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
};

type State = {
  headerHeight: number
}

class CardStack extends React.Component<Props, State> {

  _screenDetails = {};

  constructor(props: Props) {
    super(props);
    this.state = {
      headerHeight: (props.isIOS ? 45 : 41) + props.statusBarSize,
    };
    // (this: any)._trackState = this._trackState.bind(this);
    (this: any)._hasSplitPaneComponent = this._hasSplitPaneComponent.bind(this);
  }

  componentWillReceiveProps(props: Props, nextProps: Props) {
    if (props.statusBarSize !== this.props.statusBarSize) {
      this.setState({
        headerHeight: (this.props.isIOS ? 45 : 41) + this.props.statusBarSize,
      });
    }

    props.scenes.forEach((newScene: *) => {
      if (
        this._screenDetails[newScene.key] &&
        this._screenDetails[newScene.key].state !== newScene.route
      ) {
        this._screenDetails[newScene.key] = null;
      }
    });
  }

  _hasSplitPaneComponent(scene) {
    return this.props.isMultiPaneEligible === true && scene.route.leftSplitPaneComponent != null;
  }

  _renderHeader(scene: NavigationScene, headerMode: HeaderMode): ?React.Node {
    // Caribou Start
    const accessibilityOption = this.props.hasModal ? 'no-hide-descendants' : 'yes';
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
    if (headerMode === 'float') {
      floatingHeader = this._renderHeader(
        this.props.transitionProps.scene,
        headerMode
      );
    }
    const { scenes } = this.props;

    const containerStyle = [
      styles.container,
      this._getTransitionConfig().containerStyle,
    ];

    return (
      <View style={containerStyle}>
        <View style={styles.scenes}>
          {scenes.map(s => this._renderCard(s))}
        </View>
        {floatingHeader}
      </View>
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

    const paddingTop = route.hideNavBar || route.noNavBar ? 0 : this.state.headerHeight;
    const isActiveRoute = scene.isActive && !this.props.hasModal;

    return (
      <View style={{ flex: 1, paddingTop, backgroundColor: theme.white }}
        testID={`Screen_${scene.route.routeName}_${isActiveRoute ? 'IsActive' : 'IsNotActive'}`}
      >
        <View style={{ flexDirection: 'row', flex: 1 }}>
          {
              hasSplitPaneComponent && SplitPaneComponent &&
              <View style={{ width: 300, borderRightWidth: 1, borderColor: theme.lightGrey }}>
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
          }
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

  _getTransitionConfig = (isAnimateFromBottom) => {
    const isModal = this.props.mode === 'modal';

    return TransitionConfigs.getTransitionConfig(
      this.props.transitionConfig,
      /* $FlowFixMe */
      {},
      /* $FlowFixMe */
      {},
      isModal || isAnimateFromBottom,
    );
  };

  _renderCard = (scene: NavigationScene): React.Node => {

    const { screenInterpolator } = this._getTransitionConfig(scene.route.animateFromBottom);
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
