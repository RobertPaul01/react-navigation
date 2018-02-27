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
import getChildEventSubscriber from '../../getChildEventSubscriber';
import SceneView from '../SceneView';

import TransitionConfigs from './TransitionConfigs';
import * as ReactNativeFeatures from '../../utils/ReactNativeFeatures';

const emptyFunction = () => {};

const EaseInOut = Easing.inOut(Easing.ease);

/**
 * The max duration of the card animation in milliseconds after released gesture.
 * The actual duration should be always less then that because the rest distance
 * is always less then the full distance of the layout.
 */
const ANIMATION_DURATION = 500;

/**
 * The gesture distance threshold to trigger the back behavior. For instance,
 * `1/2` means that moving greater than 1/2 of the width of the screen will
 * trigger a back action
 */
const POSITION_THRESHOLD = 1 / 2;

/**
 * The threshold (in pixels) to start the gesture action.
 */
const RESPOND_THRESHOLD = 20;

/**
 * The distance of touch start from the edge of the screen where the gesture will be recognized
 */
const GESTURE_RESPONSE_DISTANCE_HORIZONTAL = 25;
const GESTURE_RESPONSE_DISTANCE_VERTICAL = 135;

const animatedSubscribeValue = animatedValue => {
  if (!animatedValue.__isNative) {
    return;
  }
  if (Object.keys(animatedValue._listeners).length === 0) {
    animatedValue.addListener(emptyFunction);
  }
};

class CardStack extends React.Component {
  /**
   * Used to identify the starting point of the position when the gesture starts, such that it can
   * be updated according to its relative position. This means that a card can effectively be
   * "caught"- If a gesture starts while a card is animating, the card does not jump into a
   * corresponding location for the touch.
   */
  _gestureStartValue = 0;

  // tracks if a touch is currently happening
  _isResponding = false;

  /**
   * immediateIndex is used to represent the expected index that we will be on after a
   * transition. To achieve a smooth animation when swiping back, the action to go back
   * doesn't actually fire until the transition completes. The immediateIndex is used during
   * the transition so that gestures can be handled correctly. This is a work-around for
   * cases when the user quickly swipes back several times.
   */
  _immediateIndex = null;

  _screenDetails = {};

  _childEventSubscribers = {};

  componentWillReceiveProps(props) {
    if (props.screenProps !== this.props.screenProps) {
      this._screenDetails = {};
    }
    props.transitionProps.scenes.forEach(newScene => {
      if (
        this._screenDetails[newScene.key] &&
        this._screenDetails[newScene.key].state !== newScene.route
      ) {
        this._screenDetails[newScene.key] = null;
      }
    });
  }

  componentDidUpdate() {
    const activeKeys = this.props.transitionProps.navigation.state.routes.map(
      route => route.key
    );
    Object.keys(this._childEventSubscribers).forEach(key => {
      if (!activeKeys.includes(key)) {
        delete this._childEventSubscribers[key];
      }
    });
  }

  _isRouteFocused = route => {
    const { transitionProps: { navigation: { state } } } = this.props;
    const focusedRoute = state.routes[state.index];
    return route === focusedRoute;
  };

  _getScreenDetails = scene => {
    const { screenProps, transitionProps: { navigation }, router } = this.props;
    let screenDetails = this._screenDetails[scene.key];
    if (!screenDetails || screenDetails.state !== scene.route) {
      if (!this._childEventSubscribers[scene.route.key]) {
        this._childEventSubscribers[scene.route.key] = getChildEventSubscriber(
          navigation.addListener,
          scene.route.key
        );
      }

      const screenNavigation = addNavigationHelpers({
        dispatch: navigation.dispatch,
        state: scene.route,
        isFocused: () => this._isRouteFocused(scene.route),
        addListener: this._childEventSubscribers[scene.route.key],
      });
      screenDetails = {
        state: scene.route,
        navigation: screenNavigation,
        options: router.getScreenOptions(screenNavigation, screenProps),
      };
      this._screenDetails[scene.key] = screenDetails;
    }
    return screenDetails;
  };

  _renderHeader(scene, headerMode) {
    const { header } = this._getScreenDetails(scene).options;

    if (typeof header !== 'undefined' && typeof header !== 'function') {
      return header;
    }

    const renderHeader = header || (props => <Header {...props} />);
    const {
      headerLeftInterpolator,
      headerTitleInterpolator,
      headerRightInterpolator,
    } = this._getTransitionConfig();

    const {
      mode,
      transitionProps,
      prevTransitionProps,
      ...passProps
    } = this.props;

    return renderHeader({
      ...passProps,
      ...transitionProps,
      scene,
      mode: headerMode,
      transitionPreset: this._getHeaderTransitionPreset(),
      getScreenDetails: this._getScreenDetails,
      leftInterpolator: headerLeftInterpolator,
      titleInterpolator: headerTitleInterpolator,
      rightInterpolator: headerRightInterpolator,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  _animatedSubscribe(props) {
    // Hack to make this work with native driven animations. We add a single listener
    // so the JS value of the following animated values gets updated. We rely on
    // some Animated private APIs and not doing so would require using a bunch of
    // value listeners but we'd have to remove them to not leak and I'm not sure
    // when we'd do that with the current structure we have. `stopAnimation` callback
    // is also broken with native animated values that have no listeners so if we
    // want to remove this we have to fix this too.
    animatedSubscribeValue(props.transitionProps.layout.width);
    animatedSubscribeValue(props.transitionProps.layout.height);
    animatedSubscribeValue(props.transitionProps.position);
  }

  _reset(resetToIndex, duration) {
    if (
      Platform.OS === 'ios' &&
      ReactNativeFeatures.supportsImprovedSpringAnimation()
    ) {
      Animated.spring(this.props.transitionProps.position, {
        toValue: resetToIndex,
        stiffness: 5000,
        damping: 600,
        mass: 3,
        useNativeDriver: this.props.transitionProps.position.__isNative,
      }).start();
    } else {
      Animated.timing(this.props.transitionProps.position, {
        toValue: resetToIndex,
        duration,
        easing: EaseInOut,
        useNativeDriver: this.props.transitionProps.position.__isNative,
      }).start();
    }
  }

  _goBack(backFromIndex, duration) {
    const { navigation, position, scenes } = this.props.transitionProps;
    const toValue = Math.max(backFromIndex - 1, 0);

    // set temporary index for gesture handler to respect until the action is
    // dispatched at the end of the transition.
    this._immediateIndex = toValue;

    const onCompleteAnimation = () => {
      this._immediateIndex = null;
      const backFromScene = scenes.find(s => s.index === toValue + 1);
      if (!this._isResponding && backFromScene) {
        navigation.dispatch(
          NavigationActions.back({
            key: backFromScene.route.key,
            immediate: true,
          })
        );
      }
    };

    if (
      Platform.OS === 'ios' &&
      ReactNativeFeatures.supportsImprovedSpringAnimation()
    ) {
      Animated.spring(position, {
        toValue,
        stiffness: 5000,
        damping: 600,
        mass: 3,
        useNativeDriver: position.__isNative,
      }).start(onCompleteAnimation);
    } else {
      Animated.timing(position, {
        toValue,
        duration,
        easing: EaseInOut,
        useNativeDriver: position.__isNative,
      }).start(onCompleteAnimation);
    }
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
      floatingHeader = this._renderHeader(
        this.props.transitionProps.scene,
        headerMode
      );
    }
    const {
      transitionProps: { navigation, position, layout, scene, scenes },
      mode,
    } = this.props;
    const { index } = navigation.state;
    const isVertical = mode === 'modal';
    const { options } = this._getScreenDetails(scene);
    const gestureDirectionInverted = options.gestureDirection === 'inverted';

    const gesturesEnabled =
      typeof options.gesturesEnabled === 'boolean'
        ? options.gesturesEnabled
        : Platform.OS === 'ios';

    const responder = !gesturesEnabled
      ? null
      : PanResponder.create({
          onPanResponderTerminate: () => {
            this._isResponding = false;
            this._reset(index, 0);
          },
          onPanResponderGrant: () => {
            position.stopAnimation(value => {
              this._isResponding = true;
              this._gestureStartValue = value;
            });
          },
          onMoveShouldSetPanResponder: (event, gesture) => {
            if (index !== scene.index) {
              return false;
            }
            const immediateIndex =
              this._immediateIndex == null ? index : this._immediateIndex;
            const currentDragDistance = gesture[isVertical ? 'dy' : 'dx'];
            const currentDragPosition =
              event.nativeEvent[isVertical ? 'pageY' : 'pageX'];
            const axisLength = isVertical
              ? layout.height.__getValue()
              : layout.width.__getValue();
            const axisHasBeenMeasured = !!axisLength;

            // Measure the distance from the touch to the edge of the screen
            const screenEdgeDistance = gestureDirectionInverted
              ? axisLength - (currentDragPosition - currentDragDistance)
              : currentDragPosition - currentDragDistance;
            // Compare to the gesture distance relavant to card or modal
            const {
              gestureResponseDistance: userGestureResponseDistance = {},
            } = this._getScreenDetails(scene).options;
            const gestureResponseDistance = isVertical
              ? userGestureResponseDistance.vertical ||
                GESTURE_RESPONSE_DISTANCE_VERTICAL
              : userGestureResponseDistance.horizontal ||
                GESTURE_RESPONSE_DISTANCE_HORIZONTAL;
            // GESTURE_RESPONSE_DISTANCE is about 25 or 30. Or 135 for modals
            if (screenEdgeDistance > gestureResponseDistance) {
              // Reject touches that started in the middle of the screen
              return false;
            }

            const hasDraggedEnough =
              Math.abs(currentDragDistance) > RESPOND_THRESHOLD;

            const isOnFirstCard = immediateIndex === 0;
            const shouldSetResponder =
              hasDraggedEnough && axisHasBeenMeasured && !isOnFirstCard;
            return shouldSetResponder;
          },
          onPanResponderMove: (event, gesture) => {
            // Handle the moving touches for our granted responder
            const startValue = this._gestureStartValue;
            const axis = isVertical ? 'dy' : 'dx';
            const axisDistance = isVertical
              ? layout.height.__getValue()
              : layout.width.__getValue();
            const currentValue =
              (I18nManager.isRTL && axis === 'dx') !== gestureDirectionInverted
                ? startValue + gesture[axis] / axisDistance
                : startValue - gesture[axis] / axisDistance;
            const value = clamp(index - 1, currentValue, index);
            position.setValue(value);
          },
          onPanResponderTerminationRequest: () =>
            // Returning false will prevent other views from becoming responder while
            // the navigation view is the responder (mid-gesture)
            false,
          onPanResponderRelease: (event, gesture) => {
            if (!this._isResponding) {
              return;
            }
            this._isResponding = false;

            const immediateIndex =
              this._immediateIndex == null ? index : this._immediateIndex;

            // Calculate animate duration according to gesture speed and moved distance
            const axisDistance = isVertical
              ? layout.height.__getValue()
              : layout.width.__getValue();
            const movementDirection = gestureDirectionInverted ? -1 : 1;
            const movedDistance =
              movementDirection * gesture[isVertical ? 'dy' : 'dx'];
            const gestureVelocity =
              movementDirection * gesture[isVertical ? 'vy' : 'vx'];
            const defaultVelocity = axisDistance / ANIMATION_DURATION;
            const velocity = Math.max(
              Math.abs(gestureVelocity),
              defaultVelocity
            );
            const resetDuration = gestureDirectionInverted
              ? (axisDistance - movedDistance) / velocity
              : movedDistance / velocity;
            const goBackDuration = gestureDirectionInverted
              ? movedDistance / velocity
              : (axisDistance - movedDistance) / velocity;

            // To asyncronously get the current animated value, we need to run stopAnimation:
            position.stopAnimation(value => {
              // If the speed of the gesture release is significant, use that as the indication
              // of intent
              if (gestureVelocity < -0.5) {
                this._reset(immediateIndex, resetDuration);
                return;
              }
              if (gestureVelocity > 0.5) {
                this._goBack(immediateIndex, goBackDuration);
                return;
              }

              // Then filter based on the distance the screen was moved. Over a third of the way swiped,
              // and the back will happen.
              if (value <= index - POSITION_THRESHOLD) {
                this._goBack(immediateIndex, goBackDuration);
              } else {
                this._reset(immediateIndex, resetDuration);
              }
            });
          },
        });

    const handlers = gesturesEnabled ? responder.panHandlers : {};
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
          {scenes.map(s => this._renderCard(s))}
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

  _getHeaderTransitionPreset() {
    // On Android or with header mode screen, we always just use in-place,
    // we ignore the option entirely (at least until we have other presets)
    if (Platform.OS === 'android' || this._getHeaderMode() === 'screen') {
      return 'fade-in-place';
    }

    // TODO: validations: 'fade-in-place' or 'uikit' are valid
    if (this.props.headerTransitionPreset) {
      return this.props.headerTransitionPreset;
    } else {
      return 'fade-in-place';
    }
  }

  _renderInnerScene(SceneComponent, scene) {
    const { navigation } = this._getScreenDetails(scene);
    const { screenProps } = this.props;
    const headerMode = this._getHeaderMode();
    if (headerMode === 'screen') {
      return (
        <View style={styles.container}>
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
      this.props.transitionProps,
      this.props.prevTransitionProps,
      isModal
    );
  };

  _renderCard = scene => {
    const { screenInterpolator } = this._getTransitionConfig();
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
