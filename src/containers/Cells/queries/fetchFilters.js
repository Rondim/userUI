import gql from 'graphql-tag';

export default gql`
    query (
    $aIds: [ID!],
    $availabilitiesEvery: [SidebarFilterFilter!],
    $instancesEvery: [SidebarFilterFilter!],
    $itemsEvery: [SidebarFilterFilter!]
    ){
        someFilters: allSidebarFilters(filter:{ OR: [
            { availabilities_some: { id_in: $aIds }}
            { instances_some: { availabilities_some: { id_in: $aIds } } },
            { items_some: { instances_some: { availabilities_some: { id_in: $aIds } } } }
        ]}){
            id
            property{
                id
            }
        }
        everyFilters: allSidebarFilters(filter:{ OR: [
            { AND: $availabilitiesEvery },
            { AND: $instancesEvery }
            { AND: $itemsEvery }
        ]}){
            id
            property{
                id
            }
        }
    }
`;