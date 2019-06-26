import * as React from "react";
import { ApolloClient, ApolloConsumer } from "react-apollo";
import { RouteComponentProps } from "react-router";

import { MetaWrapper, NotFound, OfflinePlaceholder } from "../../components";
import NetworkStatus from "../../components/NetworkStatus";
import { AttributeList, Filters } from "../../components/ProductFilters";

import {
  convertSortByFromString,
  convertToAttributeScalar,
  getAttributesFromQs,
  getGraphqlIdFromDBId,
  maybe,
  parseQueryString,
  updateQueryString
} from "../../core/utils";
import Page from "./Page";
import {
  LocalProductsNumberQuery,
  TypedCategoryProductsQuery
} from "./queries";

type ViewProps = RouteComponentProps<{
  id: string;
}>;

const updateProductsPerPage = (client: ApolloClient<any>) => (
  productsPerPage: number
) => {
  client.writeData({
    data: {
      productsPerPage,
    },
  });
};

export const View: React.FC<ViewProps> = ({ match, location, history }) => {
  const querystring = parseQueryString(location);
  const updateQs = updateQueryString(location, history);
  const attributes: AttributeList = getAttributesFromQs(querystring);

  const filters: Filters = {
    attributes,
    pageSize: 3, // PRODUCTS_PER_PAGE,
    priceGte: parseInt(querystring.priceGte, 0) || null,
    priceLte: parseInt(querystring.priceLte, 0) || null,
    sortBy: querystring.sortBy || null,
  };
  const variables = {
    ...filters,
    attributes: convertToAttributeScalar(filters.attributes),
    id: getGraphqlIdFromDBId(match.params.id, "Category"),
    sortBy: convertSortByFromString(filters.sortBy),
  };

  return (
    <ApolloConsumer>
      {client => {
        // tslint:disable-next-line:no-console
        console.log("client", client);
        return (
          <LocalProductsNumberQuery>
            {({ data: { productsPerPage } }) => {
              return (
                <NetworkStatus>
                  {isOnline => (
                    <TypedCategoryProductsQuery
                      variables={{ ...variables, pageSize: productsPerPage }}
                      errorPolicy="all"
                      loaderFull
                    >
                      {({ loading, data, loadMore }) => {
                        // tslint:disable-next-line:no-console
                        console.log("data", data);
                        // tslint:disable-next-line:no-console
                        console.log("edges", data.products.edges);
                        const canDisplayFilters = maybe(
                          () => !!data.attributes.edges && !!data.category.name,
                          false
                        );

                        if (canDisplayFilters) {
                          const handleLoadMore = () =>
                            loadMore(
                              (prev, next) => {
                                // tslint:disable-next-line:no-console
                                console.log(
                                  "update",
                                  productsPerPage + next.products.edges.length
                                );
                                updateProductsPerPage(client)(
                                  productsPerPage + next.products.edges.length
                                );
                                return {
                                  ...prev,
                                  products: {
                                    ...prev.products,
                                    edges: [
                                      ...prev.products.edges,
                                      ...next.products.edges,
                                    ],
                                    pageInfo: next.products.pageInfo,
                                  },
                                };
                              },
                              { after: data.products.pageInfo.endCursor }
                            );

                          return (
                            <MetaWrapper
                              meta={{
                                description: data.category.seoDescription,
                                title: data.category.seoTitle,
                                type: "product.category",
                              }}
                            >
                              <Page
                                attributes={data.attributes.edges.map(
                                  edge => edge.node
                                )}
                                category={data.category}
                                displayLoader={loading}
                                hasNextPage={maybe(
                                  () => data.products.pageInfo.hasNextPage,
                                  false
                                )}
                                filters={filters}
                                products={data.products}
                                onAttributeFiltersChange={updateQs}
                                onLoadMore={handleLoadMore}
                                onOrder={value => updateQs("sortBy", value)}
                                onPriceChange={updateQs}
                              />
                            </MetaWrapper>
                          );
                        }

                        if (data && data.category === null) {
                          return <NotFound />;
                        }

                        if (!isOnline) {
                          return <OfflinePlaceholder />;
                        }
                      }}
                    </TypedCategoryProductsQuery>
                  )}
                </NetworkStatus>
              );
            }}
          </LocalProductsNumberQuery>
        );
      }}
    </ApolloConsumer>
  );
};

export default View;
