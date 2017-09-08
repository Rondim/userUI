import React from 'react';
import PropTypes from 'prop-types';

const ProductListItem = ({ active, complited, handleSelect, img, id, disabled }) => {
  let activeClass = active && !disabled ? 'active' : '';
  let complitedClass = complited ? 'complited' : '';
  activeClass = !disabled && !active && !complited ? 'bad' : activeClass;
  return (
    <div cols={1} className={`product_item ${complitedClass} ${activeClass}`}>
      <a href="#" onClick={handleSelect}>
        <img src={img} id={id} width={190} height={190} />
      </a>
    </div>
  );
};
ProductListItem.propTypes = {
  active: PropTypes.bool,
  complited: PropTypes.bool,
  img: PropTypes.string.isRequired,
  handleSelect: PropTypes.func.isRequired,
  id: PropTypes.string.isRequired,
  disabled: PropTypes.bool
};

export default ProductListItem;
