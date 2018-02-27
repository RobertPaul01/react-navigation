import React from 'react';
import { NativeModules } from 'react-native';

import CardStack from './CardStack';
import CardStackStyleInterpolator from './CardStackStyleInterpolator';
import Transitioner from '../Transitioner';
import TransitionConfigs from './TransitionConfigs';

const NativeAnimatedModule =
  NativeModules && NativeModules.NativeAnimatedModule;

class CardStackTransitioner extends React.Component {
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
      // TODO setting useNativeDriver to false as a workaround.
      // Problem: Page freezes/doesn't respond to touch events when animations
      // swap between Card and CardStack now that the container view of
      // CardStack is an Animated.View (so it can do the flip transition)
      // Example 1 - Login in as SSO clicking a portal tile, logout, try to interact with Login page
      // Example 2 - Go to forgot password and back from Login, try to interact with Login page
      // Every time I get 1 to work, 2 breaks, and vice versa. Setting this to false solves both

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
        transitionProps={props}
        prevTransitionProps={prevProps}
      />
    );
  };
}

export default CardStackTransitioner;
