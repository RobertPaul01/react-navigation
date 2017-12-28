import React from 'react';
import propTypes from 'prop-types';

export default class SceneView extends React.PureComponent {
  static childContextTypes = {
    navigation: propTypes.object.isRequired,
  };

  getChildContext() {
    return {
      navigation: this.props.navigation,
    };
  }


  render() {
    const { routeProps, component: Component, scene } = this.props;
    const isActiveRoute = scene.isActive && !this.props.hasModal;
    return (
      <Component
        {...routeProps}
        key={scene.key}

        // routeKey used for ScreenFocusAware
        routeKey={scene.route.key}
        handleNavigate={this.props.handleNavigate}
        trackPage={data => this._trackState(scene.route, data)}
        handleBack={this.props.handleBackAction}
        isActiveRoute={isActiveRoute}
        isTopScreen={scene.isActive}
        />
    )
  }
}
