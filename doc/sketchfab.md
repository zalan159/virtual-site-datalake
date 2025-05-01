# Sketchfab API
The Sketchfab REST API provide access to read and write Sketchfab data. Users are authentified with their Sketchfab API Token or OAuth2 credentials. Responses are formatted in JSON. Inputs are in JSON unless specified otherwise.

## How to make authenticated requests

Some endpoints require users to be authenticated. Users can log in with OAuth2 (preferred), or an API Token.
When an endpoint requires authentication, you need to send an extra HTTP header:

* for OAuth2: `Authorization: Bearer {INSERT_OAUTH_ACCESS_TOKEN_HERE}`
* for API Token: `Authorization: Token {INSERT_API_TOKEN_HERE}`

Some model endpoints referring to password-protected models require a password encoded in base64 in request header: `x-skfb-model-pwd: {base64(THE_PASSWORD)}`

See the [Sketchfab Login (OAuth2) documentation](https://sketchfab.com/developers/oauth) for more information on authentication.

## Pagination

When a request gives many results, results are paginated using cursors.
Each response will contain these fields you can use to make subsequent requests:

* next: full URL containing the next results.
* previous: full URL containing the previous results.
* cursors: an object containing the previous and next cursor that you can use to build the URL to the previous/next results.

By default, pages contain 24 items. You can use the `count` parameter to change the number of items per page. This parameter is capped to 24: it will be ignored if a higher value is passed; the default value will be applied instead.

## Date format

Dates are formatted using the ISO 8601 format.

## Limits and quotas

Calls to the API can be throttled to limit abuse. When your application is being throttled, it will
receive a `429 Too Many Requests` response. This means that you must wait before making more requests.


## Version: 3.0.0

### Security
**Token**  

|apiKey|*API Key*|
|---|---|
|Name|Authorization|
|In|header|

### /v3/orgs/{orgUid}

#### GET
##### Description:

Returns the detail of an organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgDetailResponse](#OrgDetailResponse) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### PATCH
##### Description:

Returns the detail of an organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| biography | formData | Updates the organizations biography | No | string |
| city | formData | Updates the organizations city | No | string |
| country | formData | Updates the organnizations country | No | string |
| displayName | formData | Updates the organnizations display name | No | string |
| twitterUsername | formData | Updates the organnizations twitter username | No | string |
| facebookUsername | formData | Updates the organnizations facebook username | No | string |
| linkedinUsername | formData | Updates the organnizations linkedin username | No | string |
| tagline | formData | Updates the organnizations tagline | No | string |
| website | formData | Updates the organnizations website | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgDetailResponse](#OrgDetailResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/me/subscriptions/{uid}

#### DELETE
##### Description:

Unsubscribes to a collection.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The collection UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 401 | Authentication credentials were not provided or do not match |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/models/{uid}/transfer-to-org

#### POST
##### Description:

Move a model from an individual account to an organization

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The model UID | Yes | string |
| org | formData | The organization UID | Yes | string |
| project | formData | The project UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgModelDetailResponse](#OrgModelDetailResponse) |
| 400 | Bad Request. Model cannot be transfered to the org. |  |
| 401 | Unauthorized. User token is not valid or missing. |  |
| 403 | Permission Denied |  |
| 404 | Not Found. Model does not exist. |  |
| 429 | Too many requests. You must wait before making requests again. |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/orgs/{orgUid}/matcaps/{matcapUid}

#### DELETE
##### Description:

Deletes a matcap in the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| matcapUid | path | The matcap UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Retrieve a matcap in the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| matcapUid | path | The matcap UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgMatcapDetail](#OrgMatcapDetail) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/users

#### GET
##### Description:

Returns a list of users.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| sort_by | query |  | No | string |
| account | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [UserResponse](#UserResponse) |

### /v3/comments

#### POST
##### Description:

Creates a comment

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| model | formData | <a href="#/models" target="_blank">Model</a> (uid) to comment | Yes | string |
| body | formData | Sets a body | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 400 | Bad Request |  |
| 429 | Too many requests |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns a list of comments from public, published models

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| sort_by | query | Sorts results | No | string |
| model | query | Retrieves comments of a model (urlid) | No | string |
| user | query | Retrieves comments of a <a href="#!/users/" target="_blank">user</a> (username) | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [CommentResponse](#CommentResponse) |

### /v3/collections

#### POST
##### Description:

Creates a collection.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| name | formData | Sets a name | Yes | string |
| description | formData | Sets a description | Yes | string |
| models | formData | Sets <a href="#/models" target="_blank">models</a> (uid) | No | [ string ] |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns a list of collections

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| user | query | Retrieves collections created by <a href="#!/users/" target="_blank">user</a> (username) | No | string |
| uids | query | Retrieves collections by uid | No | [ string ] |
| created_since | query | Retrieves collections created since a date (ISO 8601 format) | No | date |
| restricted | query | Retrieves restricted collections (off by default) | No | boolean |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [CollectionResponse](#CollectionResponse) |

### /v3/me

#### GET
##### Description:

Returns your profile

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [MeDetail](#MeDetail) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### PATCH
##### Description:

Updates your profile.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| password | formData | Updates your password. Needs passwordConfirmation | No | string |
| passwordConfirmation | formData |  | No | string |
| skills | formData | Updates your <a href="#/skills" target="_blank">skills</a> (uid) | No | [ string ] |
| displayName | formData | Updates your display name | No | string |
| twitterUsername | formData | Updates your twitter username | No | string |
| facebookUsername | formData | Updates your facebook username | No | string |
| linkedinUsername | formData | Updates your linkedin username | No | string |
| biography | formData | Updates your bio | No | string |
| tagline | formData | Updates your tagline | No | string |
| website | formData | Updates your website | No | string |
| city | formData | Updates your city | No | string |
| country | formData | Updates your country | No | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Authentication credentials were not provided or do not match |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/orgs/{orgUid}/backgrounds

#### POST
##### Description:

Creates a new background in the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| image | formData | JPG or PNG image. Max 4mb | Yes | file |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns a list of backgrounds from the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgBackgroundListResponse](#OrgBackgroundListResponse) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/models/{uid}

#### PUT
##### Description:

Reuploads a model. Accepts multipart/form-data only.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The model UID | Yes | string |
| name | formData | Sets a name | No | string |
| private | formData | Sets private (requires a pro plan or higher) | No | boolean |
| isInspectable | formData | Enables 2D view in model inspector. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>. | No | boolean |
| isAgeRestricted | formData | Whether the model has restricted content. | No | boolean |
| password | formData | Sets a password (requires a pro plan or higher) | No | string |
| license | formData | Sets a <a href=#!/licenses/ target='_blank'>license</a> (label). This makes the model downloadable to others. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>.  | No | string (test) |
| tags | formData | Sets <a href=#!/tags/ target='_blank'>tags</a> (slug) | No | [ string ] |
| categories | formData | Sets <a href=#!/categories/ target='_blank'>categories</a> (slug) | No | [ string ] |
| isArEnabled | formData | Enables AR for a model (requires a premium plan or higher) | No | boolean |
| isPublished | formData | Sets published after it is processed | No | boolean |
| description | formData | Sets a description | No | string |
| modelFile | formData | Model archive. Max 50mb for basic users, 200mb for pro users, 500mb for biz users | Yes | file |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns the detail of a model

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The model UID | Yes | string |
| x-skfb-model-pwd | header | Password when the model is password-protected | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [ModelDetail](#ModelDetail) |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

#### PATCH
##### Description:

Updates model information.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The model UID | Yes | string |
| name | formData | Sets a name | No | string |
| private | formData | Sets private (requires a pro plan or higher) | No | boolean |
| isInspectable | formData | Enables 2D view in model inspector. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>. | No | boolean |
| isAgeRestricted | formData | Whether the model has restricted content. | No | boolean |
| password | formData | Sets a password (requires a pro plan or higher) | No | string |
| license | formData | Sets a <a href=#!/licenses/ target='_blank'>license</a> (slug). This makes the model downloadable to others. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>.  | No | string (test) |
| tags | formData | Sets <a href=#!/tags/ target='_blank'>tags</a> (slug) | No | [ string ] |
| categories | formData | Sets <a href=#!/categories/ target='_blank'>categories</a> (slug) | No | [ string ] |
| isArEnabled | formData | Enables AR for a model (requires a premium plan or higher) | No | boolean |
| isPublished | formData | Sets published after it is processed | No | boolean |
| hasCommentsDisabled | formData | Disables public comments for the model | No | boolean |
| description | formData | Sets a description | No | string |
| price | formData | Sets a price. Your model must have either standard or editorial license. | No | integer |
| options | formData | Sets <a href=#!/models/patch_v3_models_uid_options target='_blank'>options</a> | No | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### DELETE
##### Description:

Deletes one of your models

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The model UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/me/environments

#### POST
##### Description:

Creates an environment (pro only). Accepts multipart/form-data only.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| name | formData | Sets a name | Yes | string |
| environmentFile | formData |  | Yes | file |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns available environments for your models.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [EnvironmentResponse](#EnvironmentResponse) |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/users/{uid}

#### GET
##### Description:

Returns the detail of a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The user UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [UserDetail](#UserDetail) |
| 404 | Not Found |  |

### /v3/me/backgrounds

#### POST
##### Description:

Creates a new background (requires a pro plan or higher). Accepts multipart/form-data only.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| image | formData | JPG or PNG image. Max 4mb | Yes | file |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns available backgrounds for your models

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [BackgroundResponse](#BackgroundResponse) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/models/{uid}/options

#### PATCH
##### Description:

Updates the 3D options of a model

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The model UID | Yes | string |
| shading | formData | Defines the shading type | No | string |
| background | formData | Defines the background used. Either a color, a <a href="#/backgrounds" target="_blank">background</a> (uid), an <a href="#/environment" target="_blank">environment</a> (uid) or transparent. eg: {"color": "#ffffff"}, {"environment": "uid"}, {"image": "uid"} or {"transparent": 1}  | No | string |
| orientation | formData | Either a 4x4 matrix or an angle with an axis. eg: {"axis": [1, 1, 0], "angle": 34} or {"matrix": [0.1, 0.2, 0.3 ... ], "axis": [1, 1, 0], "angle": 34.42}  | No | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No-Content |
| 400 | Bad Request |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |

### /v3/tags/{slug}

#### GET
##### Description:

Returns the detail of a tag

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| slug | path | The tag slug | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [TagRelated](#TagRelated) |

### /v3/me/subscriptions

#### POST
##### Description:

Subscribes to a collection.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| collection | formData | The <a href="#/collections" target="_blank">collection</a> (uid) to subscribe to | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns collections you subscribed to.

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [CollectionResponse](#CollectionResponse) |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/orgs/{orgUid}/environments/{environmentUid}

#### PATCH
##### Description:

Updates an environment in the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| environmentUid | path | The environment UID | Yes | string |
| name | formData | Updates the name | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### DELETE
##### Description:

Deletes an environment in the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| environmentUid | path | The environment UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Retrieve an environment in the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| environmentUid | path | The environment UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgEnvironmentDetail](#OrgEnvironmentDetail) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/collections/{uid}

#### GET
##### Description:

Returns the detail of a collection

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The collection UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [CollectionDetail](#CollectionDetail) |

#### PATCH
##### Description:

Updates a collection

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The collection UID | Yes | string |
| name | formData | Updates the name | Yes | string |
| description | formData | Updates the description | No | string |
| models | formData | Sets <a href="#/models" target="_blank">models</a> (uid) | No | [ string ] |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Authentication credentials were not provided or do not match |

### /v3/comments/{uid}

#### DELETE
##### Description:

Deletes one of your comments

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The comment UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/me/likes

#### POST
##### Description:

Likes a model

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| model | formData | <a href="#/models" target="_blank">Model</a> (uid) to like | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| sort_by | query | Sorts results. | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [LikeModelResponse](#LikeModelResponse) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/licenses

#### GET
##### Description:

Returns a list of licenses

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [LicensesResponse](#LicensesResponse) |

### /v3/models

#### POST
##### Description:

Uploads a new model. Accepts multipart/form-data only.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| name | formData | Sets a name | No | string |
| private | formData | Sets private (requires a pro plan or higher) | No | boolean |
| isInspectable | formData | Enables 2D view in model inspector. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>. | No | boolean |
| password | formData | Sets a password (requires a pro plan or higher) | No | string |
| license | formData | Sets a <a href=#!/licenses/ target='_blank'>license</a> (slug). This makes the model downloadable to others. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>. | No | string (test) |
| tags | formData | Sets <a href=#!/tags/ target='_blank'>tags</a> (slug) | No | [ string ] |
| categories | formData | Sets <a href=#!/categories/ target='_blank'>categories</a> (slug) | No | [ string ] |
| isArEnabled | formData | Enables AR for a model (requires a premium plan or higher) | No | boolean |
| isPublished | formData | Sets published after it is processed | No | boolean |
| description | formData | Sets a description | No | string |
| modelFile | formData | Model archive. Max 50mb for basic users, 200mb for pro users, 500mb for biz users | Yes | file |
| options | formData | Sets <a href=#!/models/patch_v3_models_uid_options target='_blank'>options</a> after it is processed | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns a public, published list of models.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| sort_by | query | Sorts results (likedAt is only usable with liked_by). | No | string |
| user | query | Retrieves models filtered by a <a href="#!/users/" target="_blank">user</a> (username) | No | string |
| tags | query | Retrieves models filtered by <a href="#!/tags/" target="_blank">tags</a> (slug) | No | [ string ] |
| categories | query | Retrieves models filtered by <a href=#!/categories/get_v3_categories target='_blank'>categories</a> (uid) | No | [ string ] |
| liked_by | query | Retrieves models liked by a <a href="#!/users/" target="_blank">user</a> (username). This can't be used with other filters. | No | string |
| max_face_count | query |  | No | integer |
| max_vertex_count | query |  | No | integer |
| published_since | query | Retrieves the models published after published_since (ISO 8601 format) | No | date |
| staffpicked | query | Retrieves staffpicked models | No | boolean |
| downloadable | query | Retrieves downloadable models | No | boolean |
| animated | query | Retrieves animated models | No | boolean |
| has_sound | query | Retrieves models with sound | No | boolean |
| restricted | query | Retrieves age restricted models (off by default) | No | boolean |
|  |  |  | No | [archivesFlavoursFilter](#archivesFlavoursFilter) |
|  |  |  | No | [searchParamAvailableArchiveType](#searchParamAvailableArchiveType) |
|  |  |  | No | [searchParamArchivesMaxSize](#searchParamArchivesMaxSize) |
|  |  |  | No | [searchParamArchivesMaxFaceCount](#searchParamArchivesMaxFaceCount) |
|  |  |  | No | [searchParamArchivesMaxVertexCount](#searchParamArchivesMaxVertexCount) |
|  |  |  | No | [searchParamArchivesMaxTextureCount](#searchParamArchivesMaxTextureCount) |
|  |  |  | No | [searchParamArchivesTextureMaxResolution](#searchParamArchivesTextureMaxResolution) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [ModelResponse](#ModelResponse) |

### /v3/me/account

#### GET
##### Description:

Returns account information of the logged user

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [MeAccount](#MeAccount) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/orgs/{orgUid}/environments

#### POST
##### Description:

Creates a new environment in the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| name | formData | Sets a name | Yes | string |
| environmentFile | formData |  | Yes | file |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns a list of environments from the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgEnvironmentListResponse](#OrgEnvironmentListResponse) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/orgs/{orgUid}/tags

#### GET
##### Description:

Returns a list of tags used by the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| sort_by | query | Sorts projects by this param. | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgTagsListResponse](#OrgTagsListResponse) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/categories/{uid}

#### GET
##### Description:

Return the details of a category

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The category UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [CategoriesRelated](#CategoriesRelated) |

### /v3/skills

#### GET
##### Description:

Returns the list of skills

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [SkillsResponse](#SkillsResponse) |

### /v3/me/models/purchases

#### GET
##### Description:

Returns the list of models you bought on sketchfab's store

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| q | query | Space separated keywords. | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [MeModelResponse](#MeModelResponse) |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/collections/{uid}/models

#### POST
##### Description:

Adds models to a collection.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The collection UID | Yes | string |
| models | formData | Adds <a href="#/models" target="_blank">models</a> (uid) | No | [ string ] |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not found |  |

#### GET
##### Description:

Returns a list of models for a collection

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The collection UID | Yes | string |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [CollectionModelResponse](#CollectionModelResponse) |
| 404 | Not found |  |

#### DELETE
##### Description:

Removes models from a collection

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The collection UID | Yes | string |
| models | query | Removes <a href="#/models" target="_blank">models</a> (uid) | No | [ string ] |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | Success |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not found |

### /v3/users/{uid}/followings

#### GET
##### Description:

Returns users followed by a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The user UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [UserResponse](#UserResponse) |
| 404 | Not Found |  |

### /v3/models/{uid}/download

#### GET
##### Description:

Returns download information for downloadable models

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The model UID | Yes | string |
| x-skfb-model-pwd | header | Model password when the model is password-protected | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [ModelDownload](#ModelDownload) |
| 400 | Bad Request. Model is not downloadable. |  |
| 401 | Unauthorized. User token is not valid or missing. |  |
| 403 | Permission Denied |  |
| 404 | Not Found. Model does not exist. |  |
| 429 | Too many requests. You must wait before making requests again. |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/me/orgs

#### GET
##### Description:

Returns the list of orgs the current user belongs to

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [MeOrgs](#MeOrgs) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/search?type=collections

#### GET
##### Description:

Search in collections

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| q | query |  | No | string |
| user | query | Searches collections by <a href="#!/users/" target="_blank">user</a> (username) | No | string |
| date | query | Limit search to a specific period only (in days) | No | integer |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [CollectionSearchResponse](#CollectionSearchResponse) |

### /v3/orgs/{orgUid}/models/{modelUid}/options

#### PATCH
##### Description:

Updates the 3D options of a model. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | TThe organization UID | Yes | string |
| modelUid | path | The model UID | Yes | string |
| shading | formData | Defines the shading type | No | string |
| background | formData | Defines the background used. Either a color, a <a href="#/backgrounds" target="_blank">background</a> (uid), an <a href="#/environment" target="_blank">environment</a> (uid) or transparent. eg: {"color": "#ffffff"}, {"environment": "uid"}, {"image": "uid"} or {"transparent": 1}  | No | string |
| orientation | formData | Either a 4x4 matrix or an angle with an axis. eg: {"axis": [1, 1, 0], "angle": 34} or {"matrix": [0.1, 0.2, 0.3 ... ], "axis": [1, 1, 0], "angle": 34.42}  | No | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No-Content |
| 400 | Bad Request |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/me/matcaps

#### POST
##### Description:

Creates a new matcap

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| image | formData | JPG or PNG image. Max 4mb | Yes | file |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns a list of matcaps for your models

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [MatcapsList](#MatcapsList) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/avatars/{uid}

#### GET
##### Description:

Returns a user avatar

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The avatar UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [AvatarRelated](#AvatarRelated) |

### /v3/me/environments/{uid}

#### PATCH
##### Description:

Updates an environment (requires a pro plan or higher).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The environment UID | Yes | string |
| name | formData | Updates the name | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### DELETE
##### Description:

Deletes an environment (requires a pro plan or higher)

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The environment UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/skills/{slug}

#### GET
##### Description:

Returns the detail of a skill

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| slug | path | The skill slug | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [SkillDetail](#SkillDetail) |

### /v3/orgs/{orgUid}/matcaps

#### POST
##### Description:

Creates a new matcap in the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| image | formData | JPG or PNG image. Max 4mb | Yes | file |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [CreateResponse](#CreateResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns a list of matcaps from the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgMatcapsListResponse](#OrgMatcapsListResponse) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/users/{uid}/followers

#### GET
##### Description:

Returns the followers of a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The user UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [UserResponse](#UserResponse) |
| 404 | Not Found |  |

### /v3/me/search?type=models

#### GET
##### Description:

Search and filters in your own models

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
|  |  |  | No | [searchParamQ](#searchParamQ) |
|  |  |  | No | [searchParamTags](#searchParamTags) |
|  |  |  | No | [searchParamCategories](#searchParamCategories) |
|  |  |  | No | [searchParamProcessingStatus](#searchParamProcessingStatus) |
|  |  |  | No | [searchParamDate](#searchParamDate) |
|  |  |  | No | [searchParamDownloadable](#searchParamDownloadable) |
|  |  |  | No | [searchParamAnimated](#searchParamAnimated) |
|  |  |  | No | [searchParamStaffpicked](#searchParamStaffpicked) |
|  |  |  | No | [searchParamSound](#searchParamSound) |
|  |  |  | No | [searchParamMinFaceCount](#searchParamMinFaceCount) |
|  |  |  | No | [searchParamMaxFaceCount](#searchParamMaxFaceCount) |
|  |  |  | No | [searchParamPbrType](#searchParamPbrType) |
|  |  |  | No | [searchParamRigged](#searchParamRigged) |
|  |  |  | No | [searchParamCollection](#searchParamCollection) |
|  |  |  | No | [searchParamSortBy](#searchParamSortBy) |
|  |  |  | No | [searchParamFileFormat](#searchParamFileFormat) |
|  |  |  | No | [searchParamLicense](#searchParamLicense) |
|  |  |  | No | [searchParamMaxUvLayerCount](#searchParamMaxUvLayerCount) |
|  |  |  | No | [searchParamMaxFilesizes](#searchParamMaxFilesizes) |
|  |  |  | No | [archivesFlavoursFilter](#archivesFlavoursFilter) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Models matching the search | [ModelSearchResponse](#ModelSearchResponse) |

### /v3/orgs/{orgUid}/backgrounds/{backgroundUid}

#### DELETE
##### Description:

Deletes a background in the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| backgroundUid | path | The background UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Retrieve a background in the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| backgroundUid | path | The background UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgBackgroundDetail](#OrgBackgroundDetail) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/me/followings/{uid}

#### DELETE
##### Description:

Un-follows a user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The user UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 401 | Authentication credentials were not provided or do not match |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/models/{uid}/archives/extra/latest

#### GET
##### Description:

Retrieve a model's extra archive.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The model UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [ArchiveExtra](#ArchiveExtra) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### DELETE
##### Description:

Delete a model's extra archive, only for orgs and users with a paid plan.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The model UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/search?type=models

#### GET
##### Description:

Search and filters in models

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
|  |  |  | No | [searchParamQ](#searchParamQ) |
|  |  |  | No | [searchParamUser](#searchParamUser) |
|  |  |  | No | [searchParamTags](#searchParamTags) |
|  |  |  | No | [searchParamCategories](#searchParamCategories) |
|  |  |  | No | [searchParamDate](#searchParamDate) |
|  |  |  | No | [searchParamDownloadable](#searchParamDownloadable) |
|  |  |  | No | [searchParamAnimated](#searchParamAnimated) |
|  |  |  | No | [searchParamStaffpicked](#searchParamStaffpicked) |
|  |  |  | No | [searchParamSound](#searchParamSound) |
|  |  |  | No | [searchParamMinFaceCount](#searchParamMinFaceCount) |
|  |  |  | No | [searchParamMaxFaceCount](#searchParamMaxFaceCount) |
|  |  |  | No | [searchParamPbrType](#searchParamPbrType) |
|  |  |  | No | [searchParamRigged](#searchParamRigged) |
|  |  |  | No | [searchParamCollection](#searchParamCollection) |
|  |  |  | No | [searchParamSortBy](#searchParamSortBy) |
|  |  |  | No | [searchParamFileFormat](#searchParamFileFormat) |
|  |  |  | No | [searchParamLicense](#searchParamLicense) |
|  |  |  | No | [searchParamMaxUvLayerCount](#searchParamMaxUvLayerCount) |
|  |  |  | No | [searchParamAvailableArchiveType](#searchParamAvailableArchiveType) |
|  |  |  | No | [searchParamArchivesMaxSize](#searchParamArchivesMaxSize) |
|  |  |  | No | [searchParamArchivesMaxFaceCount](#searchParamArchivesMaxFaceCount) |
|  |  |  | No | [searchParamArchivesMaxVertexCount](#searchParamArchivesMaxVertexCount) |
|  |  |  | No | [searchParamArchivesMaxTextureCount](#searchParamArchivesMaxTextureCount) |
|  |  |  | No | [searchParamArchivesTextureMaxResolution](#searchParamArchivesTextureMaxResolution) |
|  |  |  | No | [archivesFlavoursFilter](#archivesFlavoursFilter) |
| processing_status | query | DEPRECATED: This filter will have no impact on the returned results | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Models matching the search | [ModelSearchResponse](#ModelSearchResponse) |

### /v3/me/collections

#### GET
##### Description:

Returns a list of your collections

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [CollectionResponse](#CollectionResponse) |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/orgs/{orgUid}/models/{modelUid}

#### PUT
##### Description:

Reuploads an organization model. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| modelUid | path | The model UID | Yes | string |
| name | formData | Sets a model name | No | string |
| orgProject | formData | Define the organization project you want to upload to | Yes | string |
| source | formData | Define the upload source | No | string |
| visibility | formData | Sets the model visibility | No | string |
| isInspectable | formData | Enables 2D view in model inspector. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>. | No | boolean |
| password | formData | Sets a password. This option can only be used when visibility is protected. | No | string |
| license | formData | Sets a <a href=#!/licenses/ target='_blank'>license</a> (slug). This makes the model downloadable to others. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>. | No | string |
| tags | formData | Sets <a href=#!/tags/ target='_blank'>tags</a> (slug) | No | [ string ] |
| categories | formData | Sets <a href=#!/categories/ target='_blank'>categories</a> (slug). Two categories max for a model. | No | [ string ] |
| description | formData | Sets the model description | No | string |
| modelFile | formData | Archive of the model to be processed. | Yes | file |
| options | formData | Sets <a href=#!/models/patch_v3_models_uid_options target='_blank'>options</a> after it is processed | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgModelDetailResponse](#OrgModelDetailResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns the detail of an organization model. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| modelUid | path | The model UID | Yes | string |
| x-skfb-model-pwd | header | Password when the model is password-protected | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgModelDetailResponse](#OrgModelDetailResponse) |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### PATCH
##### Description:

Updates organization model information. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| modelUid | path | The model UID | Yes | string |
| name | formData | Sets a model name | No | string |
| orgProject | formData | Define the organization project you want to upload to | Yes | string |
| source | formData | Define the upload source | No | string |
| visibility | formData | Sets the model visibility | No | string |
| isInspectable | formData | Enables 2D view in model inspector. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>. | No | boolean |
| isAgeRestricted | formData | Whether the model has restricted content. | No | boolean |
| password | formData | Sets a password. This option can only be used when visibility is protected. | No | string |
| license | formData | Sets a <a href=#!/licenses/ target='_blank'>license</a> (slug). This makes the model downloadable to others. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>. | No | string |
| tags | formData | Sets <a href=#!/tags/ target='_blank'>tags</a> (slug) | No | [ string ] |
| categories | formData | Sets <a href=#!/categories/ target='_blank'>categories</a> (slug). Two categories max for a model. | No | [ string ] |
| description | formData | Sets the model description | No | string |
| modelFile | formData | Archive of the model to be processed. | Yes | file |
| options | formData | Sets <a href=#!/models/patch_v3_models_uid_options target='_blank'>options</a> after it is processed | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgModelDetailResponse](#OrgModelDetailResponse) |
| 400 | Bad Request |  |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### DELETE
##### Description:

Deletes an organization model. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| modelUid | path | The model UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/search

#### GET
##### Description:

Search in models, collections, users

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| q | query | Space separated keywords. | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Models, collections, users matching the search | [GlobalSearchResponse](#GlobalSearchResponse) |

### /v3/orgs/{orgUid}/projects

#### POST
##### Description:

Creates projects within the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| name | query |  | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [OrgProjectListResponse](#OrgProjectListResponse) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns a list of projects from the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
|  |  |  | No | [queryFilter](#queryFilter) |
| sort_by | query | Sorts projects by this param. | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgProjectListResponse](#OrgProjectListResponse) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/licences/{uid}

#### GET
##### Description:

Returns the detail of a license.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The license UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [LicensesDetail](#LicensesDetail) |
| 404 | Not Found |  |

### /v3/me/backgrounds/{uid}

#### DELETE
##### Description:

Deletes a background (requires a pro plan or higher)

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The background UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/orgs/{orgUid}/search?type=projects

#### GET
##### Description:

Search and filters in given org projects

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | Can take either the organization UID (orgUid) or name preceded by a @ (@orgName). | Yes | string |
|  |  |  | No | [queryFilter](#queryFilter) |
|  |  |  | No | [parentProjectFilter](#parentProjectFilter) |
|  |  |  | No | [projectDepthFilter](#projectDepthFilter) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Projects matching the search | [ProjectSearchResponse](#ProjectSearchResponse) |

### /v3/orgs/{orgUid}/search?type=models

#### GET
##### Description:

Search and filters in given org models

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | Can take either the organization UID (orgUid) or name preceded by a @ (@orgName). | Yes | string |
|  |  |  | No | [queryFilter](#queryFilter) |
|  |  |  | No | [usersFilter](#usersFilter) |
|  |  |  | No | [foldersFilter](#foldersFilter) |
|  |  |  | No | [projectsFilter](#projectsFilter) |
|  |  |  | No | [minFaceCountFilter](#minFaceCountFilter) |
|  |  |  | No | [maxFaceCountFilter](#maxFaceCountFilter) |
|  |  |  | No | [animatedFilter](#animatedFilter) |
|  |  |  | No | [pbrFilter](#pbrFilter) |
|  |  |  | No | [riggedFilter](#riggedFilter) |
|  |  |  | No | [allVisibilitiesFilter](#allVisibilitiesFilter) |
|  |  |  | No | [downloadableFilter](#downloadableFilter) |
|  |  |  | No | [orgTagsFilter](#orgTagsFilter) |
|  |  |  | No | [searchParamAvailableArchiveType](#searchParamAvailableArchiveType) |
|  |  |  | No | [searchParamArchivesMaxSize](#searchParamArchivesMaxSize) |
|  |  |  | No | [searchParamArchivesMaxFaceCount](#searchParamArchivesMaxFaceCount) |
|  |  |  | No | [searchParamArchivesMaxVertexCount](#searchParamArchivesMaxVertexCount) |
|  |  |  | No | [searchParamArchivesMaxTextureCount](#searchParamArchivesMaxTextureCount) |
|  |  |  | No | [searchParamArchivesTextureMaxResolution](#searchParamArchivesTextureMaxResolution) |
|  |  |  | No | [searchParamFileFormat](#searchParamFileFormat) |
|  |  |  | No | [archivesFlavoursFilter](#archivesFlavoursFilter) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Models matching the search | [ModelSearchResponse](#ModelSearchResponse) |

### /v3/me/matcaps/{matcapUid}

#### DELETE
##### Description:

Deletes a matcap

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| matcapUid | path | The matcap UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Retrieve a matcap

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| matcapUid | path | The matcap UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [MatcapDetail](#MatcapDetail) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/me/followings

#### POST
##### Description:

Follows a new user.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| toUser | formData | <a href="#/users" target="_blank">User</a> (uid) to follow | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 401 | Authentication credentials were not provided or do not match |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns a list of users you follow.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [UserResponse](#UserResponse) |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/categories

#### GET
##### Description:

Returns a list of categories

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [CategoriesResponse](#CategoriesResponse) |

### /v3/models/{uid}/archives/extra

#### POST
##### Description:

Adds or replace a model's extra archive, only for orgs and users with a paid plan.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | The model UID | Yes | string |
| extraFile | formData | Model's extra archive. Max 2Gb. | Yes | file |

##### Responses

| Code | Description |
| ---- | ----------- |
| 201 | Created |
| 400 | Bad Request |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/me/models

#### GET
##### Description:

Returns a list of your models

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| downloadable | query | Retrieves downloadable models | No | boolean |
|  |  |  | No | [archivesFlavoursFilter](#archivesFlavoursFilter) |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [MeModelResponse](#MeModelResponse) |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/me/likes/{uid}

#### DELETE
##### Description:

Un-likes a model

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uid | path | <a href="#/models" target="_blank">Model</a> (uid) to un-like | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Authentication credentials were not provided or do not match |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/orgs/{orgUid}/models

#### POST
##### Description:

Uploads a new model to the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| name | formData | Sets a model name | No | string |
| orgProject | formData | Define the organization project you want to upload to | Yes | string |
| source | formData | Define the upload source | No | string |
| visibility | formData | Sets the model visibility | No | string |
| isInspectable | formData | Enables 2D view in model inspector. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>. | No | boolean |
| isAgeRestricted | formData | Whether the model has restricted content. | No | boolean |
| password | formData | Sets a password. This option can only be used when visibility is protected. | No | string |
| license | formData | Sets a <a href=#!/licenses/ target='_blank'>license</a> (slug). This makes the model downloadable to others. All <a href="https://help.sketchfab.com/hc/en-us/articles/115004862686-Inspector">downloadable models must have isInspectable enabled</a>. | No | string |
| tags | formData | Sets <a href=#!/tags/ target='_blank'>tags</a> (slug) | No | [ string ] |
| categories | formData | Sets <a href=#!/categories/ target='_blank'>categories</a> (slug). Two categories max for a model. | No | [ string ] |
| description | formData | Sets the model description | No | string |
| modelFile | formData | Archive of the model to be processed. | Yes | file |
| options | formData | Sets <a href=#!/models/patch_v3_models_uid_options target='_blank'>options</a> after it is processed | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 201 | Created | [OrgModelDetailResponse](#OrgModelDetailResponse) |
| 401 | Authentication credentials were not provided or do not match. |  |
| 403 | You're not allowed to post in this organization. |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### GET
##### Description:

Returns a list of models from the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
|  |  |  | No | [queryFilter](#queryFilter) |
|  |  |  | No | [usersFilter](#usersFilter) |
|  |  |  | No | [foldersFilter](#foldersFilter) |
|  |  |  | No | [projectsFilter](#projectsFilter) |
|  |  |  | No | [minFaceCountFilter](#minFaceCountFilter) |
|  |  |  | No | [maxFaceCountFilter](#maxFaceCountFilter) |
|  |  |  | No | [animatedFilter](#animatedFilter) |
|  |  |  | No | [pbrFilter](#pbrFilter) |
|  |  |  | No | [riggedFilter](#riggedFilter) |
|  |  |  | No | [allVisibilitiesFilter](#allVisibilitiesFilter) |
|  |  |  | No | [downloadableFilter](#downloadableFilter) |
|  |  |  | No | [orgTagsFilter](#orgTagsFilter) |
|  |  |  | No | [searchParamAvailableArchiveType](#searchParamAvailableArchiveType) |
|  |  |  | No | [searchParamArchivesMaxSize](#searchParamArchivesMaxSize) |
|  |  |  | No | [searchParamArchivesMaxFaceCount](#searchParamArchivesMaxFaceCount) |
|  |  |  | No | [searchParamArchivesMaxVertexCount](#searchParamArchivesMaxVertexCount) |
|  |  |  | No | [searchParamArchivesMaxTextureCount](#searchParamArchivesMaxTextureCount) |
|  |  |  | No | [searchParamArchivesTextureMaxResolution](#searchParamArchivesTextureMaxResolution) |
|  |  |  | No | [archivesFlavoursFilter](#archivesFlavoursFilter) |
| sort_by | query | Sorts models by this param. | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgModelListResponse](#OrgModelListResponse) |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/orgs/{orgUid}/projects/{projectUid}

#### GET
##### Description:

Retrieve a project within the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| projectUid | path | The project UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgProjectListResponse](#OrgProjectListResponse) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### PATCH
##### Description:

Update a project within the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| projectUid | path | The project UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [OrgProjectListResponse](#OrgProjectListResponse) |
| 401 | Authentication credentials were not provided or do not match |  |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

#### DELETE
##### Description:

Remove a project within the given organization. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| projectUid | path | The project UID | Yes | string |

##### Responses

| Code | Description |
| ---- | ----------- |
| 204 | No content |
| 401 | Authentication credentials were not provided or do not match |
| 403 | Permission Denied |
| 404 | Not Found |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### /v3/search?type=users

#### GET
##### Description:

Search and filters in users

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| q | query | Space separated keywords | No | string |
| username | query | Searches users by username | No | string |
| location | query | Searches users by country or city | No | string |
| account | query | Searches users by account type | No | string |
| skills | query | Searches users by skills (slug) | No | [ string ] |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [UserSearchResponse](#UserSearchResponse) |
| 400 | Bad Request |  |

### /v3/orgs/{orgUid}/models/{modelUid}/download

#### GET
##### Description:

Returns download information for downloadable models. Can take either the organization UID (orgUid) or name preceded by a @ (@orgName).

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| orgUid | path | The organization UID | Yes | string |
| modelUid | path | The model UID | Yes | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [ModelDownload](#ModelDownload) |
| 403 | Permission Denied |  |
| 404 | Not Found |  |

### /v3/tags

#### GET
##### Description:

Returns a list of tags

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Returns the list of tags | [TagsResponse](#TagsResponse) |

### /v3/collections/thumbnails

#### GET
##### Description:

Returns the popular thumbnails of collections

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| uids | query |  | Yes | [ string ] |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [CollectionsThumbnailsResponse](#CollectionsThumbnailsResponse) |

### /v3/me/followers

#### GET
##### Description:

Returns a list of users following you.

##### Parameters

| Name | Located in | Description | Required | Schema |
| ---- | ---------- | ----------- | -------- | ---- |
| sort_by | query |  | No | string |

##### Responses

| Code | Description | Schema |
| ---- | ----------- | ------ |
| 200 | Success | [UserResponse](#UserResponse) |
| 401 | Authentication credentials were not provided or do not match |  |

##### Security

| Security Schema | Scopes |
| --- | --- |
| Token | |

### Models


#### CollectionList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| createdAt | date |  | No |
| description | string,null |  | No |
| hasRestrictedContent | boolean |  | No |
| models | string |  | No |
| isAgeRestricted | boolean |  | No |
| uri | string |  | No |
| modelCount | integer |  | No |
| user | string |  | No |
| updatedAt | date |  | No |
| owner | [UserDetail](#UserDetail) |  | No |
| embedUrl | string |  | No |
| uid | string |  | No |
| slug | string |  | No |
| thumbnails | object |  | No |
| name | string |  | No |

#### MeDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| subscriptionCount | integer |  | No |
| followerCount | integer |  | No |
| uid | string |  | No |
| modelsUrl | string |  | No |
| likeCount | integer |  | No |
| facebookUsername | string |  | No |
| biography | string |  | No |
| city | string |  | No |
| tagline | string |  | No |
| modelCount | integer |  | No |
| twitterUsername | string |  | No |
| email | string |  | No |
| website | string |  | No |
| billingCycle | string |  | No |
| followersUrl | string |  | No |
| collectionCount | integer |  | No |
| dateJoined | date |  | No |
| account | string |  | No |
| displayName | string |  | No |
| profileUrl | string |  | No |
| followingsUrl | string |  | No |
| skills | [ [SkillDetail](#SkillDetail) ] |  | No |
| country | string |  | No |
| uri | string |  | No |
| apiToken | string |  | No |
| username | string |  | No |
| linkedinUsername | string |  | No |
| likesUrl | string |  | No |
| avatar | [AvatarRelated](#AvatarRelated) |  | No |
| isLimited | boolean |  | No |
| followingCount | integer |  | No |
| collectionsUrl | string |  | No |

#### MePrivateModelsLimit

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| count | integer |  | No |
| since | string |  | No |
| until | string |  | No |

#### OrgMatcapsListResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [OrgMatcapDetail](#OrgMatcapDetail) ] |  | No |

#### TagsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [TagRelated](#TagRelated) ] |  | No |

#### CollectionsThumbnailsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [ThumbnailsRelated](#ThumbnailsRelated) ] |  | No |

#### EnvironmentResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [Environment](#Environment) ] |  | No |

#### OrgBackgroundListResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [OrgBackgroundDetail](#OrgBackgroundDetail) ] |  | No |

#### Environment

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| brightness | integer |  | No |
| processing | string |  | No |
| uri | string |  | No |
| isDefault | boolean |  | No |
| diffuseSPH | string |  | No |
| createdAt | date |  | No |
| name | string |  | No |

#### UserRelated

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| username | string |  | No |
| profileUrl | string |  | No |
| account | string |  | No |
| displayName | string |  | No |
| uid | string |  | No |
| uri | string |  | No |
| avatar | [AvatarRelated](#AvatarRelated) |  | No |

#### LicensesDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| slug | string |  | No |
| requirements | string |  | No |
| url | string |  | No |
| fullName | string |  | No |
| uri | string |  | No |
| label | string |  | No |

#### OrgTextureImageDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| width | integer |  | No |
| name | string |  | No |
| uid | string |  | No |
| file | string |  | No |
| height | integer |  | No |

#### OrgModelDetailResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [OrgModelDetail](#OrgModelDetail) ] |  | No |

#### OrgEnvironmentDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| textures | [OrgTextureList](#OrgTextureList) |  | No |
| uid | string |  | No |
| brightness | number |  | No |
| processing | [ProcessingStatus](#ProcessingStatus) |  | No |
| uri | string |  | No |
| lights | [OrgLightList](#OrgLightList) |  | No |
| isDefault | boolean |  | No |
| diffuseSPH | [ number ] |  | No |
| createdAt | date |  | No |
| name | string |  | No |

#### UserDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| website | string,null |  | No |
| subscriptionCount | integer |  | No |
| followerCount | integer |  | No |
| uid | string |  | No |
| modelsUrl | string |  | No |
| portfolioUrl | string |  | No |
| likeCount | integer |  | No |
| facebookUsername | string,null |  | No |
| biography | string,null |  | No |
| dateJoined | date |  | No |
| city | string,null |  | No |
| account | string |  | No |
| displayName | string |  | No |
| profileUrl | string |  | No |
| followingsUrl | string |  | No |
| skills | [ [SkillDetail](#SkillDetail) ] |  | No |
| tagline | string,null |  | No |
| uri | string |  | No |
| modelCount | integer |  | No |
| username | string |  | No |
| linkedinUsername | string,null |  | No |
| likesUrl | string |  | No |
| followersUrl | string |  | No |
| collectionCount | integer |  | No |
| country | string,null |  | No |
| followingCount | integer |  | No |
| twitterUsername | string,null |  | No |
| collectionsUrl | string |  | No |
| avatar | [AvatarRelated](#AvatarRelated) |  | No |

#### OrgEnvironmentListResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [OrgEnvironmentDetail](#OrgEnvironmentDetail) ] |  | No |

#### ModelResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [ModelList](#ModelList) ] |  | No |

#### CollectionModelList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| tags | [ [TagRelated](#TagRelated) ] |  | No |
| viewerUrl | string |  | No |
| isProtected | boolean |  | No |
| categories | [ [CategoriesRelated](#CategoriesRelated) ] |  | No |
| publishedAt | date |  | No |
| likeCount | integer |  | No |
| commentCount | integer |  | No |
| viewCount | integer |  | No |
| vertexCount | integer |  | No |
| user | [UserRelated](#UserRelated) |  | No |
| isDownloadable | boolean |  | No |
| description | string,null |  | No |
| animationCount | integer |  | No |
| name | string |  | No |
| soundCount | integer |  | No |
| isAgeRestricted | boolean |  | No |
| uri | string |  | No |
| faceCount | integer |  | No |
| staffpickedAt | string,null (date) |  | No |
| createdAt | date |  | No |
| thumbnails | [ThumbnailsRelated](#ThumbnailsRelated) |  | No |
| embedUrl | string |  | No |

#### CollectionModelResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [CollectionModelList](#CollectionModelList) ] |  | No |

#### OrgTagsListResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [OrgTagList](#OrgTagList) ] |  | No |

#### ModelList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| tags | [ [TagRelated](#TagRelated) ] |  | No |
| viewerUrl | string |  | No |
| isProtected | boolean |  | No |
| price | integer |  | No |
| categories | [ [CategoriesRelated](#CategoriesRelated) ] |  | No |
| publishedAt | date |  | No |
| likeCount | integer |  | No |
| commentCount | integer |  | No |
| viewCount | integer |  | No |
| vertexCount | integer |  | No |
| user | [UserRelated](#UserRelated) |  | No |
| isDownloadable | boolean |  | No |
| description | string,null |  | No |
| animationCount | integer |  | No |
| name | string |  | No |
| license | string |  | No |
| soundCount | integer |  | No |
| isAgeRestricted | boolean |  | No |
| uri | string |  | No |
| faceCount | integer |  | No |
| staffpickedAt | string,null (date) |  | No |
| createdAt | date |  | No |
| thumbnails | [ThumbnailsRelated](#ThumbnailsRelated) |  | No |
| embedUrl | string |  | No |
| archives | object |  | No |

#### OrgLightDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| direction | [ number ] |  | No |
| area | object |  | No |
| color | [ number ] |  | No |
| luminosity | number |  | No |
| sum | number |  | No |
| lum_ratio | number |  | No |
| error | integer |  | No |
| variance | number |  | No |

#### LikeModelList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| tags | [ [TagRelated](#TagRelated) ] |  | No |
| viewerUrl | string |  | No |
| isProtected | boolean |  | No |
| categories | [ [CategoriesRelated](#CategoriesRelated) ] |  | No |
| publishedAt | date |  | No |
| likeCount | integer |  | No |
| commentCount | integer |  | No |
| viewCount | integer |  | No |
| vertexCount | integer |  | No |
| user | [UserRelated](#UserRelated) |  | No |
| isDownloadable | boolean |  | No |
| description | string,null |  | No |
| animationCount | integer |  | No |
| name | string |  | No |
| soundCount | integer |  | No |
| isAgeRestricted | boolean |  | No |
| uri | string |  | No |
| faceCount | integer |  | No |
| staffpickedAt | string,null (date) |  | No |
| createdAt | date |  | No |
| thumbnails | [ThumbnailsRelated](#ThumbnailsRelated) |  | No |
| embedUrl | string |  | No |

#### ArchiveNested

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| faceCount | integer |  | No |
| textureCount | integer |  | No |
| size | integer | archive size (in bytes) | No |
| vertexCount | integer |  | No |
| textureMaxResolution | integer |  | No |

#### ProcessingStatus

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| ProcessingStatus | string |  |  |

#### CategoriesRelated

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uri | string |  | No |
| uid | string |  | No |
| name | string |  | No |
| slug | string |  | No |

#### MatcapDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| name | string |  | No |
| updatedAt | date |  | No |
| images | [ImagesList](#ImagesList) |  | No |
| uri | string,null |  | No |
| createdAt | date |  | No |
| isDefault | boolean |  | No |

#### ModelDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| publishedAt | date |  | No |
| likeCount | integer |  | No |
| commentCount | integer |  | No |
| updatedAt | date |  | No |
| isDownloadable | boolean |  | No |
| isAgeRestricted | boolean |  | No |
| pbrType | string |  | No |
| materialCount | integer |  | No |
| name | string |  | No |
| source | string |  | No |
| staffpickedAt | string,null (date) |  | No |
| createdAt | date |  | No |
| embedUrl | string |  | No |
| status | object |  | No |
| description | string,null |  | No |
| tags | [ [TagRelated](#TagRelated) ] |  | No |
| viewerUrl | string |  | No |
| isProtected | boolean |  | No |
| price | integer |  | No |
| textureCount | integer |  | No |
| vertexCount | integer |  | No |
| user | [UserRelated](#UserRelated) |  | No |
| categories | [ [CategoriesRelated](#CategoriesRelated) ] |  | No |
| animationCount | integer |  | No |
| viewCount | integer |  | No |
| thumbnails | [ThumbnailsRelated](#ThumbnailsRelated) |  | No |
| license | object |  | No |
| editorUrl | string |  | No |
| soundCount | integer |  | No |
| uri | string |  | No |
| faceCount | integer |  | No |
| hasCommentsDisabled | boolean |  | No |
| downloadCount | integer |  | No |

#### CommentResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| body | string |  | No |
| uid | string |  | No |
| uri | string |  | No |
| createdAt | date |  | No |
| user | [UserRelated](#UserRelated) |  | No |
| updatedAt | date |  | No |
| model | [ModelRelated](#ModelRelated) |  | No |
| isDeleted | boolean |  | No |

#### GlobalSearchResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | object |  | No |

#### MeAccount

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| account | string |  | No |
| uploadSizeLimit | integer |  | No |
| viewOnlyLimit | [MeViewOnlyLimit](#MeViewOnlyLimit) |  | No |
| privateModelsLimit | [MePrivateModelsLimit](#MePrivateModelsLimit) |  | No |
| canProtectModels | string |  | No |
| renewsAt | date |  | No |
| joinedAt | date |  | No |
| billingCycle | string |  | No |

#### CategoriesResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [CategoriesRelated](#CategoriesRelated) ] |  | No |

#### CollectionSearchList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| description | string,null |  | No |
| collectionUrl | string |  | No |
| modelCount | integer |  | No |
| user | [UserRelated](#UserRelated) |  | No |
| updatedAt | date |  | No |
| uid | string |  | No |
| embedUrl | string |  | No |
| slug | string |  | No |
| createdAt | date |  | No |
| name | string |  | No |

#### ModelSearchResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [ModelSearchList](#ModelSearchList) ] |  | No |

#### ArchiveExtra

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| status | string |  | No |
| size | integer |  | No |
| uid | string |  | No |
| name | string |  | No |
| metadata | object |  | No |

#### MeOrgs

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| username | string |  | No |
| membership | [ [MeOrgMembership](#MeOrgMembership) ] |  | No |
| orgUrl | string |  | No |
| displayName | string |  | No |
| uid | string |  | No |
| publicProfileUrl | string |  | No |

#### OrgImagesList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| OrgImagesList | array |  |  |

#### CollectionResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [CollectionList](#CollectionList) ] |  | No |

#### ModelRelated

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |

#### MeOrgMembership

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| status | string |  | No |
| role | string |  | No |
| joinedAt | date |  | No |
| uid | string |  | No |

#### SkillsResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [SkillDetail](#SkillDetail) ] |  | No |

#### UserNested

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| username | string |  | No |
| account | string |  | No |
| displayName | string |  | No |
| uid | string |  | No |
| avatar | string |  | No |

#### ProjectSearchList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| latestMembers | object |  | No |
| memberCount | integer |  | No |
| breadcrumbs | object |  | No |
| depth | integer |  | No |
| modelCount | integer |  | No |
| name | string |  | No |
| folderCount | integer |  | No |
| updatedAt | date |  | No |
| slug | string |  | No |
| thumbnails | [ThumbnailsRelated](#ThumbnailsRelated) |  | No |

#### UserSearchList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| username | string |  | No |
| city | string,null |  | No |
| followerCount | integer |  | No |
| displayName | string |  | No |
| uid | string |  | No |
| skills | [ [SkillDetail](#SkillDetail) ] |  | No |
| country | string,null |  | No |
| account | string |  | No |
| modelCount | integer |  | No |
| profileUrl | string |  | No |
| avatar | [AvatarRelated](#AvatarRelated) |  | No |

#### MeModelResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [MeModelList](#MeModelList) ] |  | No |

#### OrgNested

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| username | string |  | No |
| project | [OrgProjectNested](#OrgProjectNested) |  | No |
| displayName | string |  | No |
| uid | string |  | No |
| viewerUrl | string |  | No |
| commentCount | integer |  | No |

#### ProjectSearchResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [ProjectSearchList](#ProjectSearchList) ] |  | No |

#### ImagesList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| ImagesList | array |  |  |

#### AvatarRelated

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| images | [ object ] |  | No |
| uid | string |  | No |
| uri | string |  | No |

#### UserSearchResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [UserSearchList](#UserSearchList) ] |  | No |

#### OrgModelList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| downloadType | string |  | No |
| uid | string |  | No |
| tags | string |  | No |
| viewerUrl | string |  | No |
| orgTags | string |  | No |
| categories | string |  | No |
| publishedAt | date |  | No |
| likeCount | integer |  | No |
| commentCount | integer |  | No |
| visibility | string |  | No |
| vertexCount | integer |  | No |
| isArchivesReady | boolean |  | No |
| org | [OrgNested](#OrgNested) |  | No |
| slug | string |  | No |
| createdAt | date |  | No |
| animationCount | integer |  | No |
| viewCount | integer |  | No |
| thumbnails | string |  | No |
| license | string |  | No |
| processingStatus | string |  | No |
| soundCount | integer |  | No |
| isAgeRestricted | boolean |  | No |
| uri | string |  | No |
| name | string |  | No |
| faceCount | integer |  | No |
| staffpickedAt | date |  | No |
| archives | object |  | No |
| downloadCount | integer |  | No |
| embedUrl | string |  | No |
| user | [UserNested](#UserNested) |  | No |

#### ModelSearchList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| animationCount | integer |  | No |
| viewerUrl | string |  | No |
| publishedAt | date |  | No |
| likeCount | integer |  | No |
| commentCount | integer |  | No |
| user | [UserRelated](#UserRelated) |  | No |
| isDownloadable | boolean |  | No |
| name | string |  | No |
| viewCount | integer |  | No |
| thumbnails | [ThumbnailsRelated](#ThumbnailsRelated) |  | No |
| license | string |  | No |
| isPublished | boolean |  | No |
| staffpickedAt | string,null (date) |  | No |
| archives | object |  | No |
| embedUrl | string |  | No |

#### OrgDetailResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [OrgDetail](#OrgDetail) ] |  | No |

#### MatcapsList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [MatcapDetail](#MatcapDetail) ] |  | No |

#### BackgroundResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [BackgroundList](#BackgroundList) ] |  | No |

#### LikeModelResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [LikeModelList](#LikeModelList) ] |  | No |

#### OrgTextureList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| OrgTextureList | array |  |  |

#### OrgDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| username | string |  | No |
| publicProfileUrl | string |  | No |
| orgUrl | string |  | No |
| displayName | string |  | No |
| uid | string |  | No |

#### CollectionSearchResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [CollectionSearchList](#CollectionSearchList) ] |  | No |

#### SkillDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |
| uri | string |  | No |

#### UserList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| website | string,null |  | No |
| subscriptionCount | integer |  | No |
| followerCount | integer |  | No |
| uid | string |  | No |
| modelsUrl | string |  | No |
| portfolioUrl | string |  | No |
| likeCount | integer |  | No |
| facebookUsername | string,null |  | No |
| biography | string,null |  | No |
| dateJoined | date |  | No |
| city | string,null |  | No |
| account | string |  | No |
| displayName | string |  | No |
| profileUrl | string |  | No |
| followingsUrl | string |  | No |
| skills | [ [SkillDetail](#SkillDetail) ] |  | No |
| tagline | string,null |  | No |
| uri | string |  | No |
| modelCount | integer |  | No |
| username | string |  | No |
| linkedinUsername | string,null |  | No |
| likesUrl | string |  | No |
| followersUrl | string |  | No |
| collectionCount | integer |  | No |
| country | string,null |  | No |
| followingCount | integer |  | No |
| twitterUsername | string,null |  | No |
| collectionsUrl | string |  | No |
| avatar | [AvatarRelated](#AvatarRelated) |  | No |

#### OrgTagList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| slug | string |  | No |
| name | string |  | No |

#### LicensesResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [Licenses](#Licenses) ] |  | No |

#### ModelDownload

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| gltf | object |  | No |

#### ImageDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| width | string |  | No |
| updatedAt | date |  | No |
| size | string |  | No |
| uri | string |  | No |
| createdAt | date |  | No |
| height | string |  | No |

#### MeModelList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| tags | [ [TagRelated](#TagRelated) ] |  | No |
| viewerUrl | string |  | No |
| isProtected | boolean |  | No |
| categories | [ [CategoriesRelated](#CategoriesRelated) ] |  | No |
| publishedAt | date |  | No |
| likeCount | integer |  | No |
| commentCount | integer |  | No |
| viewCount | integer |  | No |
| vertexCount | integer |  | No |
| user | [UserRelated](#UserRelated) |  | No |
| isDownloadable | boolean |  | No |
| description | string,null |  | No |
| animationCount | integer |  | No |
| name | string |  | No |
| soundCount | integer |  | No |
| isAgeRestricted | boolean |  | No |
| uri | string |  | No |
| faceCount | integer |  | No |
| staffpickedAt | string,null (date) |  | No |
| createdAt | date |  | No |
| thumbnails | [ThumbnailsRelated](#ThumbnailsRelated) |  | No |
| embedUrl | string |  | No |
| archives | object |  | No |

#### OrgProjectListResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| updatedAt | string |  | No |
| memberCount | string |  | No |
| org | [OrgDetail](#OrgDetail) |  | No |
| slug | string |  | No |
| modelCount | string |  | No |
| name | string |  | No |

#### OrgBackgroundDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| name | string |  | No |
| updatedAt | date |  | No |
| images | [OrgImagesList](#OrgImagesList) |  | No |
| uri | string |  | No |
| createdAt | date |  | No |
| isDefault | boolean |  | No |

#### CreateResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| uri | string |  | No |

#### OrgModelDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| publishedAt | date |  | No |
| likeCount | integer |  | No |
| commentCount | integer |  | No |
| isArchivesReady | boolean |  | No |
| isDownloadable | boolean |  | No |
| processingStatus | string |  | No |
| isAgeRestricted | boolean |  | No |
| pbrType | string |  | No |
| materialCount | integer |  | No |
| name | string |  | No |
| staffpickedAt | date |  | No |
| createdAt | date |  | No |
| embedUrl | string |  | No |
| downloadType | string |  | No |
| description | string |  | No |
| tags | string |  | No |
| viewerUrl | string |  | No |
| isProtected | boolean |  | No |
| orgTags | string |  | No |
| visibility | string |  | No |
| textureCount | integer |  | No |
| vertexCount | integer |  | No |
| user | [UserNested](#UserNested) |  | No |
| org | [OrgNested](#OrgNested) |  | No |
| categories | string |  | No |
| animationCount | integer |  | No |
| viewCount | integer |  | No |
| thumbnails | string |  | No |
| license | string |  | No |
| soundCount | integer |  | No |
| uri | string |  | No |
| faceCount | integer |  | No |
| hasCommentsDisabled | boolean |  | No |
| downloadCount | string |  | No |

#### OrgLightList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| OrgLightList | array |  |  |

#### OrgImageDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| width | string |  | No |
| updatedAt | date |  | No |
| size | string |  | No |
| uri | string |  | No |
| createdAt | date |  | No |
| height | string |  | No |

#### ThumbnailsRelated

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| images | [ object ] |  | No |

#### OrgModelListResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [OrgModelList](#OrgModelList) ] |  | No |

#### OrgMatcapDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| name | string |  | No |
| updatedAt | date |  | No |
| images | [OrgImagesList](#OrgImagesList) |  | No |
| uri | string,null |  | No |
| createdAt | date |  | No |
| isDefault | boolean |  | No |

#### BackgroundList

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| name | string |  | No |
| updatedAt | date |  | No |
| images | string |  | No |
| uri | string |  | No |
| createdAt | date |  | No |
| isDefault | boolean |  | No |

#### MeViewOnlyLimit

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| type | string |  | No |
| remaining | integer |  | No |
| renews_at | date |  | No |

#### UserResponse

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| results | [ [UserList](#UserList) ] |  | No |

#### CollectionDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| createdAt | date |  | No |
| description | string,null |  | No |
| hasRestrictedContent | boolean |  | No |
| models | string |  | No |
| isAgeRestricted | boolean |  | No |
| uri | string |  | No |
| modelCount | integer |  | No |
| user | string |  | No |
| updatedAt | date |  | No |
| owner | [UserDetail](#UserDetail) |  | No |
| embedUrl | string |  | No |
| uid | string |  | No |
| slug | string |  | No |
| thumbnails | object |  | No |
| name | string |  | No |

#### OrgTextureDetail

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| images | [ [OrgTextureImageDetail](#OrgTextureImageDetail) ] |  | No |
| format | string |  | No |
| type | string |  | No |
| encoding | string |  | No |

#### TagRelated

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| slug | string |  | No |
| uri | string |  | No |

#### OrgProjectNested

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| uid | string |  | No |
| name | string |  | No |

#### Licenses

| Name | Type | Description | Required |
| ---- | ---- | ----------- | -------- |
| slug | string |  | No |
| requirements | string |  | No |
| url | string |  | No |
| fullName | string |  | No |
| uri | string |  | No |
| label | string |  | No |