import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Grid, AutoSizer } from 'react-virtualized';
import _ from 'lodash';
import { graphql, compose } from 'react-apollo';
import { connect } from 'react-redux';

import Loading from '../../components/Loading';
import Cell from './Cell';

import query from './queries/fetchCells.graphql';
import removeCells from './mutations/removeCells.graphql';
import removeZone from './mutations/removeZone.graphql';
import refreshZone from './mutations/refreshZone.graphql';
import createTextCell from './mutations/createTextCell.graphql';
import updateTextCell from './mutations/updateTextCell.graphql';
// import updateCells from './subscriptions/updateCells.graphql';
// import updateZones from './subscriptions/updateZones.graphql';
import { notification } from '../Notificator/actions';
import { calcActive, calcStyle, checkWebpFeature } from './libs/calc';
import placeZoneOnSheet from './mutations/placeZoneOnSheet.graphql';
import fetchPads from './queries/allPads.graphql';
import './index.css';

// import Zone from './libs/zone';
// import CellObj from './libs/cellObj';

@connect(null, { notification })
@graphql(query, {
    options: (({ sheet }) => {
      return {
        variables: {
          sheet
        }
      };
    })
  }
)
@compose(
  graphql(refreshZone, { name: 'refreshZone' }),
  graphql(removeCells, { name: 'removeCells' }),
  graphql(removeZone, { name: 'removeZone' }),
  graphql(createTextCell, { name: 'createTextCell' }),
  graphql(updateTextCell, { name: 'updateTextCell' }),
  graphql(placeZoneOnSheet, { name: 'placeZoneOnSheet' })
)
class Sheet extends Component {
  static propTypes = {
    data: PropTypes.shape({
      loading: PropTypes.bool,
      allCells: PropTypes.array,
      allZones: PropTypes.array,
      _allCellsMeta: PropTypes.object,
      fetchMore: PropTypes.func
    }),
    sheet: PropTypes.string,
    selectedCells: PropTypes.array,
    selectedGroupCells: PropTypes.object,
    selectedZone: PropTypes.object,
    onDrop: PropTypes.func,
    notification: PropTypes.func,
    refreshZone: PropTypes.func,
    removeCells: PropTypes.func,
    removeZone: PropTypes.func,
    selectSomeCells: PropTypes.func,
    selectOneCell: PropTypes.func,
    selectManyCells: PropTypes.func,
    selectZone: PropTypes.func,
    onStartDrag: PropTypes.func,
    createTextCell: PropTypes.func,
    updateTextCell: PropTypes.func,
    placeZoneOnSheet: PropTypes.func,
    busy: PropTypes.object
  };
  static defaultProps = {};

  componentWillMount() {
    checkWebpFeature('lossy', (feature, res) => this.setState({ webp: res }));
  }

  componentWillReceiveProps(nextProps, nextContext) {
    const { loading, _allCellsMeta, allCells, fetchMore } = nextProps.data;
    const { sheet } = nextProps;
    if (!loading) {
      if (_allCellsMeta && allCells && _allCellsMeta.count > allCells.length) {
        fetchMore({
          query,
          variables: { skip: allCells.length, sheet },
          updateQuery: (previousResult, { fetchMoreResult }) => {
            return {
              ...previousResult,
              allCells: [...previousResult.allCells, ...fetchMoreResult.allCells],
              _allCellsMeta: fetchMoreResult._allCellsMeta
            };
          }
        });
      } else this._grid && this._grid.forceUpdate();
    }
  }

  componentDidMount() {
    window.addEventListener('resize', () => this.setState({ height: this._container.clientHeight }));
  }


  state={
    webp: false,
    height: document.body.clientHeight-69
  };

  handleSelectCell = (ev, i, j, instId, itemId) => {
    const { allZones, allCells } = this.props.data;
    const { selectSomeCells, selectOneCell, selectManyCells, selectZone } = this.props;
    if (ev.metaKey) {
      selectSomeCells(i, j, instId, itemId);
    } else if (ev.altKey && ev.shiftKey) {
      selectZone(_.filter(allZones, o => o.type === 'Unique'), i, j);
    } else if (ev.shiftKey) {
      selectManyCells(i, j, instId, itemId, allCells);
    } else if (ev.altKey) {
      selectZone(_.filter(allZones, o => o.type !== 'Unique'), i, j);
    } else {
      const selectedCells = instId ? [{ i, j, instId, itemId }] : [{ i, j }];
      selectOneCell(selectedCells);
    }
  };

  placeZone = (id, i, j) => {
    const { sheet, placeZoneOnSheet } = this.props;
    placeZoneOnSheet({
      variables: { zoneId: id, sheetId: sheet, i, j },
      refetchQueries: [{ query, variables: { sheet } }]
    });
  };

  handleKeyDown = async (ev) => {
    const {
      removeZone, selectedZone, selectedCells, selectedGroupCells, refreshZone, unselectZone, sheet
    } = this.props;
    if (ev.keyCode===82 && ev.altKey && selectedZone) {
      await refreshZone({
        variables: { zoneId: selectedZone.id, sheetId: sheet },
        refetchQueries: [{ query, variables: { sheet } }]
      });
      this.props.notification('success', 'Зона обновлена');
    } else if (ev.keyCode === 8 || ev.keyCode === 46) {
      if (selectedZone) {
        await removeZone({
          variables: { id: selectedZone.id },
          refetchQueries: [
            { query, variables: { sheet } },
            { query: fetchPads, variables: { search: '' } },
            { query: fetchPads, variables: { typeUnique: true } }
            ]
        });
        unselectZone();
      } else if (selectedGroupCells) {
        const cells = this.selectCellsByGroup();
        await this.removeCells(cells.map(({ i, j }) => ({ i, j })), sheet);
      } else if (selectedCells) {
        await this.removeCells(selectedCells.map(({ i, j }) => ({ i, j })), sheet);
      }
    }
  };

  removeCells = async (coords, sheet) => {
    await this.props.removeCells({
      variables: { coords, sheetId: sheet },
      refetchQueries: [{ query, variables: { sheet } }]
    });
  };

  selectCellsByGroup = () => {
    const { selectedGroupCells: { i0, i1, j0, j1 } } = this.props;
    const { allCells } = this.props.data;
    return _.filter(allCells, ({ i, j })=> {
      return i>=i0 && i<=i1 && j>=j0 && j<=j1;
    });
  };

  onChangeText = (text, i, j, id) => {
    const { createTextCell, updateTextCell, sheet } = this.props;
    if (id) {
      if (!text) this.removeCells([{ i, j }], sheet);
      else updateTextCell({ variables: { id, text, sheet } });
    } else {
      text && createTextCell({ variables: { i, j, text, sheet }, refetchQueries: [{ query, variables: { sheet } }] });
    }
  };

  cellRenderer = ({ columnIndex, key, rowIndex, style }) => {
    const { allZones } = this.props.data;
    const { selectedCells, selectedGroupCells, selectedZone, onStartDrag, busy, sheet } = this.props;
    const { webp } = this.state;

    let className = '';
    let loaderBorders = { left: undefined, right: undefined, top: undefined, bottom: undefined };
    let padBorders = { left: undefined, right: undefined, top: undefined, bottom: undefined };
    let activeBorders = { left: undefined, right: undefined, top: undefined, bottom: undefined };
    let inUniqueZone = false;
    let newStyle = { ...style };
    typeof allZones === 'object' && allZones.forEach(zone => {
      switch (zone.type) {
        case 'Loader':
          loaderBorders = calcActive(zone, columnIndex, rowIndex, loaderBorders);
          break;
        case 'Pad':
          padBorders = calcActive(zone, columnIndex, rowIndex, padBorders);
          break;
        case 'Unique':
          if (zone.i0 <= rowIndex && zone.i1 >= rowIndex && zone.j0 <= columnIndex && zone.j1 >= columnIndex) {
            className += ' uniqueZone';
          }
          break;
      }
    });
    activeBorders = calcActive(selectedGroupCells, columnIndex, rowIndex, activeBorders);
    const active = !!_.find(selectedCells, o => o.i ===rowIndex && o.j === columnIndex);
    activeBorders = selectedZone ? calcActive(selectedZone, columnIndex, rowIndex, activeBorders) : activeBorders;
    const borderLeftStyle = calcStyle(active, activeBorders.left, loaderBorders.left, padBorders.left);
    newStyle.borderLeftWidth = borderLeftStyle.width;
    newStyle.borderLeftColor = borderLeftStyle.color;
    const borderRightStyle = calcStyle(active, activeBorders.right, loaderBorders.right, padBorders.right);
    newStyle.borderRightWidth = borderRightStyle.width;
    newStyle.borderRightColor = borderRightStyle.color;
    const borderTopStyle = calcStyle(active, activeBorders.top, loaderBorders.top, padBorders.top);
    newStyle.borderTopWidth = borderTopStyle.width;
    newStyle.borderTopColor = borderTopStyle.color;
    const borderBottomStyle = calcStyle(active, activeBorders.bottom, loaderBorders.bottom, padBorders.bottom);
    newStyle.borderBottomWidth = borderBottomStyle.width;
    newStyle.borderBottomColor = borderBottomStyle.color;
    let draggable = true;
    if (_.get(busy, `${rowIndex}.${columnIndex}`)) {
      className +=' busy';
      draggable = false;
    }
    const itemProps = {
      inUniqueZone,
      webp,
      draggable,
      className
    };
    try {
      return (
        <Cell
          key={key}
          active={active && 1 || activeBorders.left && 1 || activeBorders.right && 1 || activeBorders.bottom && 1 ||
          activeBorders.top && 1 || loaderBorders.left && 2 || loaderBorders.right && 2 || loaderBorders.top && 2 ||
          loaderBorders.bottom && 2 || padBorders.left && 3 || padBorders.right && 3 || padBorders.top && 3 ||
          padBorders.bottom && 3 }
          { ...itemProps }
          style={newStyle}
          row={rowIndex}
          column={columnIndex}
          onKeyDown={this.handleKeyDown}
          startDrag={(id, i, j) => onStartDrag(id, i, j)}
          onDrop={this.props.onDrop}
          onPlaceZone={this.placeZone}
          onSelect={this.handleSelectCell}
          onChangeText={this.onChangeText}
          sheetId={sheet}
        />
      );
    } catch (err) {
      console.error(err);
    }
  };

  render() {
    const { loading } = this.props.data;
    if (loading) return <div style={{ height: '100vh' }}><Loading style={{ height: '100%' }} /></div>;
    return (
      <div tabIndex="0" onKeyDown={this.handleKeyDown} style={{ flex: 1 }} ref={ref => this._container = ref} >
        <AutoSizer defaultHeight={600} disableHeight >
          {({ width }) => (
            <Grid
              cellRenderer={this.cellRenderer}
              columnCount={200}
              columnWidth={100}
              height={document.body.clientHeight-69}
              rowCount={300}
              rowHeight={100}
              width={width}
              overscanColumnCount={16}
              overscanRowCount={12}
              scrollingResetTimeInterval={10}
              ref={ref => this._grid = ref}
            />
          )}
        </AutoSizer>
      </div>
    );
  }
}

export default Sheet;
