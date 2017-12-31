import gql from 'graphql-tag';

export default gql`
    mutation ($id: ID!, $row: Int!, $column: Int){
        updateCell(id: $id, i: $row, j: $column){
            id
            i
            j
        }
    }
`;
