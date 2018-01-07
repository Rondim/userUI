import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { TabContent, TabPane, Nav, NavItem, NavLink, Button } from 'reactstrap';
import classnames from 'classnames';
import { graphql, compose } from 'react-apollo';
import { connect } from 'react-redux';
import { withStyles } from 'material-ui/styles';
import { Paper } from 'material-ui';
import _ from 'lodash';

import CatalogSidebar from '../CatalogSidebar';
import SetterSidebar from '../SetterSidebar';
import { fetchConfig, dataToConfig } from '../Catalog/queries/fetchConfig';
import fetchFilters from './queries/fetchFilters';
import { availabilityByFilter } from './queries/fetchAvailabilitiesCount';
import { setFilterToAvail, setFilterToInstance, setFilterToItem } from './mutations/setFilter';
import { unsetFilterToAvail, unsetFilterToInstance, unsetFilterToItem } from './mutations/unsetFilter';
import createFilter from './mutations/createFilter';
import Loading from '../../components/Loading';
import CountAvailabilitiesForLoad from './CountAvailabilitiesForLoad';
import { instanceSelect } from '../CatalogSidebar/actions';

const styles = theme => ({
  root: {
    margin: [0, 'auto'],
    width: '80%',
  },
  paper: {
    textAlign: 'center'
  }
});

const mapStateToProps = (state) => {
  return {
    filtersSelected: state.catalogSidebar.filtersSelected
  };
};

const calcFilterVariables = (selectedCells) => {
  let aIds = [];
  let availabilitiesEvery = [];
  let instancesEvery = [];
  let itemsEvery = [];
  selectedCells && selectedCells.forEach(({ aId }) => {
    if (aId) {
      aIds.push(aId);
      availabilitiesEvery.push({ availabilities_some: { id: aId } });
      instancesEvery.push({ instances_some: { availabilities_some: { id: aId } } });
      itemsEvery.push({ items_some: { instances_some: { availabilities_some: { id: aId } } } });
    }
  });
  return { aIds, availabilitiesEvery, instancesEvery, itemsEvery };
};

@withStyles(styles)
@connect(mapStateToProps, { instanceSelect })
@compose(
  graphql(fetchFilters, {
    name: 'filters',
    options: ({ selectedCells }) => {
      const variables = calcFilterVariables(selectedCells);
      return { variables, fetchPolicy: 'network-only' };
    }
  }),
  graphql(fetchConfig, {
    name: 'config',
    props({ config: { loading, allSidebarItems } }) {
      return {
        config: {
          loading,
          sidebarConfigData: dataToConfig(allSidebarItems),
        }
      };
    }
  })
)
  @compose(
    graphql(setFilterToItem, { name: 'setFilterToItem' }),
    graphql(unsetFilterToItem, { name: 'unsetFilterToItem' }),
    graphql(setFilterToInstance, { name: 'setFilterToInstance' }),
    graphql(unsetFilterToInstance, { name: 'unsetFilterToInstance' }),
    graphql(setFilterToAvail, { name: 'setFilterToAvail' }),
    graphql(unsetFilterToAvail, { name: 'unsetFilterToAvail' }),
    graphql(createFilter, { name: 'createFilter' })
  )
class Toolbar extends Component {
  static propTypes = {
    config: PropTypes.shape({
      loading: PropTypes.bool,
      sidebarConfigData: PropTypes.object
    }),
    filters: PropTypes.shape({
      loading: PropTypes.bool,
      someFilters: PropTypes.array,
      everyFilters: PropTypes.array
    }),
    setFilterToItem: PropTypes.func,
    unsetFilterToItem: PropTypes.func,
    setFilterToInstance: PropTypes.func,
    unsetFilterToInstance: PropTypes.func,
    setFilterToAvail: PropTypes.func,
    unsetFilterToAvail: PropTypes.func,
    mode: PropTypes.string,
    changeMode: PropTypes.func,
    onLoad: PropTypes.func,
    instanceSelect: PropTypes.func,
    createFilter: PropTypes.func,
    filtersSelected: PropTypes.object,
    classes: PropTypes.object,
    selectedCells: PropTypes.array
  };
  static defaultProps = {};

  toggle = tab => {
    const { mode, changeMode } = this.props;
    if (mode !== tab) {
      changeMode(tab);
    }
  };

  componentWillReceiveProps(nextProps, nextContext) {
    const { mode, filters: { loading, someFilters, everyFilters }, selectedCells,
      config: { sidebarConfigData, loading: configLoading }, filters, instanceSelect } = nextProps;
    if (mode === 'setter' && !loading && !configLoading && selectedCells && selectedCells.length) {
      if ( !_.isEqual(filters, this.props.filters)) {
        instanceSelect(someFilters, everyFilters, sidebarConfigData);
      }
    }
  }

  filterSet = async ({ filterGroupId, filterId }) => {
    const { selectedCells,
      config: { sidebarConfigData: { mapTypes } },
      filters: { someFilters },
      setFilterToAvail, setFilterToInstance, setFilterToItem, unsetFilterToAvail, unsetFilterToInstance,
      unsetFilterToItem } = this.props;
    let needUncheck;
    const { relation } = _.find(mapTypes, o => o.id ===filterGroupId);
    let unsetFilter;
    let setFilter;
    let ids;
    switch ( relation ) {
      case 'Item':
        unsetFilter = unsetFilterToItem;
        setFilter = setFilterToItem;
        ids = selectedCells.map(({ itemId }) => itemId);
        break;
      case 'Instance':
        unsetFilter = unsetFilterToInstance;
        setFilter = setFilterToInstance;
        ids = selectedCells.map(({ instId }) => instId);
        break;
      case 'Availability':
        unsetFilter = unsetFilterToAvail;
        setFilter = setFilterToAvail;
        ids = selectedCells.map(({ aId }) => aId);
        break;
    }
    const variables = calcFilterVariables(selectedCells);
    const options = (id) => {
      return {
        variables: { filterId, id },
        refetchQueries: [{
          query: fetchFilters,
          variables
        }]
      };
    };
    if (_.find(someFilters, o => o.id === filterId && o.property.id === filterGroupId)) {
      await Promise.all(ids.map(id => {
        return unsetFilter(options(id));
      }));
    } else if ((needUncheck = _.filter(someFilters, o => o.property.id === filterGroupId)).length) {
      // снятие фильтра если нет мультиселекта и выставление нового
      await Promise.all(ids.map(async id => {
        await Promise.all(needUncheck.map(({ id: filterId }) => {
          unsetFilter({ variables: { filterId, id } });
        }));
        await setFilter(options(id));
      }));
    } else {
      await Promise.all(ids.map(id => {
        return setFilter(options(id));
      }));
    }
  };

  handleCreateFilter = (name, color, propertyId, order) => {
    this.props.createFilter({ variables: { name, propertyId, order, color },
      refetchQueries: [{
        query: fetchConfig
      }]
    });
  };

  handleClick = () => {
    const { filtersSelected, onLoad, config: { sidebarConfigData } } = this.props;
    const filters = availabilityByFilter(filtersSelected, sidebarConfigData.mapTypes);
    onLoad(filters);
  };

  render() {
    const { config: { sidebarConfigData, loading }, filtersSelected, classes, mode,
      filters: { loading: fLoading } } = this.props;
    if (loading) return <Loading />;
    return (
      <div>
        <Nav tabs>
          <NavItem>
            <NavLink
              className={classnames({ active: mode === 'loader' })}
              onClick={() => this.toggle('loader')}
            >
              Loader
            </NavLink>
          </NavItem>
          <NavItem>
            <NavLink
              className={classnames({ active: mode === 'setter' })}
              onClick={() => this.toggle('setter')}
            >
              Setter
            </NavLink>
          </NavItem>
        </Nav>
        <TabContent activeTab={mode}>
          <TabPane tabId="loader">
            <Paper className={classes.paper}>
              <CatalogSidebar config={sidebarConfigData} />
            </Paper>
            <CountAvailabilitiesForLoad
              mapTypes={sidebarConfigData.mapTypes}
              filtersSelected={filtersSelected}
            />
            <Button color='success' onClick={this.handleClick}>Load</Button>
          </TabPane>
          <TabPane tabId="setter">
            <Paper className={classes.paper}>
              { fLoading && mode === 'setter' ? <Loading /> :
                <SetterSidebar
                  config={sidebarConfigData}
                  filterSet={this.filterSet}
                  onCreateFilter={this.handleCreateFilter} />}
            </Paper>
          </TabPane>
        </TabContent>
      </div>
    );
  }
}

export default Toolbar;
