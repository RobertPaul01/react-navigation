/* @flow */

import * as React from 'react';
import propTypes from 'prop-types';

import type {
  NavigationScreenProp,
  NavigationComponent,
  NavigationRoute,
} from '../TypeDefinition';

type Props = {
  /*
   * Props passed in by route to given screen, can be anything (ideally in
   * future we namespace this)
   */
  routeProps?: {},
  component: NavigationComponent,
};

export default class SceneView extends React.PureComponent<Props> {
  constructor(props: DFSCardNavigatorProps) {
    super(props);
    (this: any)._trackState = this._trackState.bind(this);
  }

  _trackState(route, data) {
    if (!route.trackingPageName) {
      console.warn(
        `Attribute \`trackingPageName\` not defined in routes for ${route.routeName}`
      );
    } else {
      this.props.trackingActions.trackState(route.trackingPageName, data);
    }
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
        handleBack={this.props.handleBack}
        isLeftSplitPaneComponent={this.props.isLeftSplitPaneComponent}
        isActiveRoute={isActiveRoute}
        isTopScreen={scene.isActive}
      />
    );
  }
}
