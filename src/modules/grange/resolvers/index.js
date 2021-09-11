const shedResolvers = require('./shed');
const poolResolvers = require('./pool');
const cuyResolvers = require('./cuy');
const mobilizationResolver = require('./mobilization.resolver');

const resolvers = {
    Query: {
        ...shedResolvers.queryShed,
        ...poolResolvers.queries,
        ...cuyResolvers.queries,
        ...mobilizationResolver.queries
    },
    Shed: {
        pools: poolResolvers.getPoolsInShed,
    },
    ShedPagination: {
        shedList: shedResolvers.getAllSheds,
        totalNumSheds: shedResolvers.getTotalNumberSheds
    },
    Pool: {
        cuys: cuyResolvers.getCuysInPool,
    },
    Pools: {
        poolList: poolResolvers.getAllPools,
        totalNumPools: poolResolvers.getTotalNumPools
    },
    PoolPaginationShed: {
        poolList: poolResolvers.getPoolsOfShed,
        totalNumPools: poolResolvers.getTotalNumberPoolsInShed
    },
    CuyPaginationPool: {
        cuyList: cuyResolvers.getCuysOfPool,
        totalNumCuys: cuyResolvers.getTotalNumberCuysInPool
    },
    CuyPagination: {
        cuyList: cuyResolvers.getCuyListByFilterQuery,
        totalNumCuys: cuyResolvers.getTotalNumCuysByFilterQuery
    },
    Cuys: {
        cuyList: cuyResolvers.getAllCuysList,
        totalNumCuys: cuyResolvers.getTotalNumberCuys
    },
    Mutation: {
        ...shedResolvers.mutationsShed,
        ...poolResolvers.mutations,
        ...cuyResolvers.mutations,
        ...mobilizationResolver.mutations
    }
}

module.exports = resolvers;