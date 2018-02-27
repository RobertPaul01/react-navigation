/* @flow */

import * as React from 'react';
import { Animated, NativeModules } from 'react-native';
import _ from 'lodash';

import CardStack from './CardStack';
import CardStackStyleInterpolator from './CardStackStyleInterpolator';
import Transitioner from '../Transitioner';
import TransitionConfigs from './TransitionConfigs';

const NativeAnimatedModule =
  NativeModules && NativeModules.NativeAnimatedModule;

const FLIP_FORWARD = 'FLIP_FORWARD';
const FLIP_BACKWARD = 'FLIP_BACKWARD';

const isFlipTransition = route =>
  !route.hasTransitionCompleted &&
  (route.customTransition === FLIP_FORWARD ||
    route.customTransition === FLIP_BACKWARD);

type Props = {
  headerMode: HeaderMode,
  mode: 'card' | 'modal',
  router: NavigationRouter<NavigationState, NavigationStackScreenOptions>,
  cardStyle?: ViewStyleProp,
  onTransitionStart?: () => void,
  onTransitionEnd?: () => void,
  /**
   * Optional custom animation when transitioning between screens.
   */
  transitionConfig?: () => TransitionConfig,
  isMultiPaneEligible: boolean,
} & NavigationNavigatorProps<NavigationStackScreenOptions, NavigationState>;

type State = {
  isFlipFrom: boolean,
  isFlipTo: boolean,
};

class CardStackTransitioner extends React.Component<Props, State> {
  _render: NavigationSceneRenderer;

  static defaultProps = {
    mode: 'card',
  };

  state = {
    isFlipFrom: false,
    isFlipTo: false,
  };

  render() {
    const routes = this.props.navigation.state.routes;
    const currentScene = _.last(routes);
    const previousScene = _.last(routes.slice(0, -1));
    const splitPaneToSplitPaneNav =
      this.props.isMultiPaneEligible &&
      currentScene.leftSplitPaneComponent &&
      previousScene.leftSplitPaneComponent;
    let animation = this._configureTransition;
    if (splitPaneToSplitPaneNav) {
      animation = () => ({
        timing: Animated.timing,
        duration: 0,
        useNativeDriver: true,
      });
    }

    return (
      <Transitioner
        configureTransition={animation}
        navigation={this.props.navigation}
        render={this._render}
        onTransitionStart={this.props.onTransitionStart}
        onTransitionEnd={this.props.onTransitionEnd}
        onFlipStart={() => {
          this.setState({
            isFlipFrom: true,
            isFlipTo: false,
          });
        }}
        onFlipFromComplete={() => {
          this.setState({
            isFlipFrom: false,
            isFlipTo: true,
          });
        }}
        onFlipToComplete={() => {
          this.setState({
            isFlipFrom: false,
            isFlipTo: false,
          });
        }}
        isFlipTransition={isFlipTransition(currentScene)}
      />
    );
  }

  _configureTransition = (
    // props for the new screen
    transitionProps,
    // props for the old screen
    prevTransitionProps
  ) => {
    const isModal = this.props.mode === 'modal';
    // Copy the object so we can assign useNativeDriver below
    const transitionSpec = {
      ...TransitionConfigs.getTransitionConfig(
        this.props.transitionConfig,
        transitionProps,
        prevTransitionProps,
        isModal
      ).transitionSpec,
    };
    if (
      !!NativeAnimatedModule &&
      // Native animation support also depends on the transforms used:
      CardStackStyleInterpolator.canUseNativeDriver()
    ) {
      // Internal undocumented prop
      transitionSpec.useNativeDriver = true;
    }
    return transitionSpec;
  };

  _render = (props, prevProps) => {
    const {
      screenProps,
      headerMode,
      headerTransitionPreset,
      mode,
      router,
      cardStyle,
      transitionConfig,
    } = this.props;

    const currentScene = _.last(this.props.navigation.state.routes);
    return (
      <CardStack
        screenProps={screenProps}
        headerMode={headerMode}
        headerTransitionPreset={headerTransitionPreset}
        mode={mode}
        router={router}
        cardStyle={cardStyle}
        transitionConfig={transitionConfig}
        {...props}
        headerComponent={this.props.headerComponent}
        routeActions={this.props.routeActions}
        isIOS={this.props.isIOS}
        isAndroid={this.props.isAndroid}
        isMultiPaneEligible={this.props.isMultiPaneEligible}
        statusBarSize={this.props.statusBarSize}
        trackingActions={this.props.trackingActions}
        hasModal={this.props.hasModal}
        openDrawer={this.props.openDrawer}
        handleBackAction={this.props.handleBackAction}
        handleNavigate={this.props.handleNavigate}
        modals={this.props.modals}
        isFlipTransition={isFlipTransition(currentScene)}
        isFlipFrom={this.state.isFlipFrom}
        isFlipTo={this.state.isFlipTo}
      />
    );
  };
}

export default CardStackTransitioner;
