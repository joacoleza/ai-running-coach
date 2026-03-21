/** Core user profile stored in Cosmos DB */
export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  githubUsername: string;
  createdAt: string;
  updatedAt: string;
}

/** Auth client principal from SWA */
export interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

/** Standard API error response */
export interface ApiError {
  error: string;
  message: string;
}

/** Navigation route definition */
export interface NavRoute {
  path: string;
  label: string;
  icon: string;
}
