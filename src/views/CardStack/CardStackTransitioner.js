/* @flow */

import * as React from 'react';
import {
  Animated,
  NativeModules
} from 'react-native';

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

  render() {
    const routes = this.props.navigation.state.routes;
    const currentScene = routes[routes.length - 1] || {};
    const previousScene = routes[routes.length - 2] || {};
    const splitPaneToSplitPaneNav = this.props.isMultiPaneEligible
      && currentScene.leftSplitPaneComponent && previousScene.leftSplitPaneComponent;
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
      />
    );
  };
}

export default CardStackTransitioner;
