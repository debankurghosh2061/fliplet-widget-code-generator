var selectedDataSourceId = null;
var selectedDataSourceName = null;
var widgetId = Fliplet.Widget.getDefaultId();
var dataSourceColumns = [];

Fliplet.Widget.setSaveButtonLabel("Close");
Fliplet.Widget.toggleCancelButton(false);

Fliplet.Widget.generateInterface({
  fields: [
    {
      type: "html",
      html: `Use this component to generate features within a screen using AI. The code created will be available in the developer tools.
            <br>
            <br>
            Select a data source if you want your feature to use a data source.
            <br><br>`,
    },
    {
      type: "provider",
      name: "dataSourceId",
      package: "com.fliplet.data-source-provider",
      data: function (value) {
        return {
          dataSourceTitle: "Data source",
          dataSourceId: value,
          appId: Fliplet.Env.get("appId"),
          default: {
            name: "Data source",
            entries: [],
            columns: [],
          },
          accessRules: [
            {
              allow: "all",
              type: ["select"],
            },
          ],
        };
      },
      onEvent: function (eventName, data) {
        // Listen for events fired from the provider
        if (eventName === "dataSourceSelect") {
          selectedDataSourceId = data.id;
          selectedDataSourceName = data.name;

          if (selectedDataSourceId) {
            Fliplet.DataSources.getById(selectedDataSourceId, {
              attributes: ["columns"],
            }).then(function (response) {
              dataSourceColumns = response.columns;
            });
          } else {
            dataSourceColumns = [];
          }
        }
      },
      beforeSave: function (value) {
        return value && value.id;
      },
    },
    {
      type: "html",
      html: `
        <div class="panel-group" id="accordion-1">
          <div class="panel panel-default focus-outline" data-collapse-id="3543664" data-collapse-uuid="497033ba-6a63-4bdc-9180-80a7937f27e6" tabindex="0">
            <h4 class="panel-title collapsed" data-target="#collapse-3543664" data-toggle="collapse" data-parent="#accordion-1">
              What features are available?
            </h4>
            <div class="panel-collapse collapse" id="collapse-3543664">
              <div class="panel-body"> 
                The following features are available via your prompt:
                <br>
                1. Read, insert, update, delete, join data source names (ensure you configure the security rules)
                <br>
                2. Load screen names or URLs
                <br>
                3. User data based on the columns in the user data source
                <br>
                4. Charts using eCharts library (Add echarts via Dev Tools > Libraries)
                <br>
                5. Tables using DataTables (Add datatables via Dev Tools > Libraries)
                <br>
                Note: Only the information in your prompt is shared with AI. AI cannot access your data or app.
              </div>
            </div>
          </div>
        </div>
      `
    },
    {
      name: "prompt",
      type: "textarea",
      label: "Prompt",
      default: "",
      rows: 12,
    },
    {
      type: "html",
      html: `<br>
            Clicking generate will ask AI to create the feature based on your prompt.
            <br><br>`,
    },
    {
      type: "html",
      html: '<input type="button" class="btn btn-primary generate-code" value="Generate code" />',
      ready: function () {
        $(this.$el).find(".generate-code").on("click", generateCode);
        toggleLoader(false);
      },
    },
    {
      type: "html",
      html: `<button disabled class="btn btn-primary generate-code-disabled">
                <div class="spinner-holder">
                  <div class="spinner-overlay"></div>
                </div>
                <div>Generating...</div>
            </button>`,
      ready: function () {
        toggleLoader(false);
      },
    },
    {
      type: "hidden",
      name: "css",
      label: "CSS",
      default: "",
      rows: 12,
    },
    {
      type: "hidden",
      name: "javascript",
      label: "JavaScript",
      default: "",
    },
    {
      type: "hidden",
      name: "layoutHTML",
      label: "Layout",
      default: "",
    },
    {
      type: "hidden",
      name: "regenerateCode",
      label: "Regenerate code",
      description: "Regenerate code",
      toggleLabel: "Regenerate",
      default: false,
    },
  ],
});

function toggleLoader(isDisabled) {
  if (isDisabled) {
    $(".interface").find(".generate-code-disabled").show();
    $(".interface").find(".generate-code").hide();
  } else {
    $(".interface").find(".generate-code-disabled").hide();
    $(".interface").find(".generate-code").show();
  }
}

function generateCode() {
  toggleLoader(true);
  var prompt = Fliplet.Helper.field("prompt").get();
  if (prompt) {
    return queryAI(prompt)
      .then(function (parsedContent) {
        // Save the generated code
        return saveGeneratedCode(parsedContent);
      })
      .catch(function (error) {
        toggleLoader(false);
        return Promise.reject(error);
      });
  } else {
    Fliplet.Studio.emit("reload-widget-instance", widgetId);
  }
}

function queryAI(prompt) {
  let systemPrompt = `
You are to only return the HTML, CSS, JS for the following user request. In the JS make sure that any selectors are using .ai-feature-${widgetId}

The format of the response should be as follows: 

### HTML
<div>
  <h1>Hello World</h1>
</div>
### CSS
div {
  color: red;
}
### JavaScript
document.addEventListener('DOMContentLoaded', function() {
  const div = document.querySelector('.ai-feature-${widgetId} div');
  div.style.color = 'blue';
});

For the HTML do not include any head tags, just return the html for the body. 
Use bootstrap v3.4.1 for css and styling.
Do not include any backticks in the response.
Ensure there are no syntax errors in the code and that column names with spaced in them are wrapped with square brackets.
Add inline comments for the code so technical users can make edits to the code. 
Add try catch blocks in the code to catch any errors and log the errors to the console. 
Ensure you chain all the promises correctly with return statements.
You must only return code in the format specified. Do not return any text.

If you get asked to use datasource js api for e.g. if you need to save data from a form to a datasource or need to read data dynamic data to show it on the screen you need to use the following API: 

If the user has provided a selected data source then use that in your data source requests. If not do not assume any data source name. 

User provided data source name: ${selectedDataSourceName}

These are the list of columns in the data source selected by the user: ${dataSourceColumns}, you must one of these when referencing data from a data source. 


# Data Sources JS APIs

The Data Source JS APIs allows you to interact and make any sort of change to your app's Data Sources from the app itself.

## Data Sources

### Get the list of data sources in use by the current app

Use the "appId" and "includeInUse" options together to get the list of data sources owned or in use by the current app.


Fliplet.DataSources.get({
  appId: Fliplet.Env.get('masterAppId'),
  includeInUse: true
}).then(function (dataSources) {
 // dataSources is an array of data sources in use by the current app
});


### Get a data source by ID

Use the "getById" function to fetch details about a data source by its ID. You can optionally pass a list of "attributes" to return.


Fliplet.DataSources.getById(123, {
  attributes: ['name', 'hooks', 'columns']
}).then(function (dataSource) {

});

### Connect to a data source by ID


Fliplet.DataSources.connect(dataSourceId).then(function (connection) {
  // check below for the list of instance methods for the connection object
});


Once you get a **connection**, you can use the instance methods described below to **find, insert, update and delete data source entries**.

### Connect to a data source by Name

You can also connect to a datas ource by its name (case-sensitive) using the "connectByName" method.


Fliplet.DataSources.connectByName("Attendees").then(function (connection) {
  // check below for the list of instance methods for the connection object
});

---

## Connection instance methods

### Fetch records from a data source

#### Fetch all records

 
// use"find" with no options to get all entries
connection.find().then(function (records) {
  // records is an array
});
 

#### Fetch records with a query

Querying options are based on the [Sift.js](https://github.com/Fliplet/sift.js) operators, which mimic MongoDB querying operators. Here are the supported operators from Sift.js:

  - "$in", "$nin", "$exists", "$gte", "$gt", "$lte", "$lt", "$eq", "$ne", "$iLike", "$mod", "$all", "$and", "$or", "$nor", "$not", "$size", "$type", "$regex", "$elemMatch"

The following operators and values are optimized to perform better with Fliplet's database.

  - Operators: "$or", "$and", "$gte", "$lte", "$gt", "$lt", "$eq"
  - Values: strings and numbers

Fliplet also supports a custom "$filters" operator with some unique conditional logic such as case-insensitive match or date & time comparison. See example below.

A few examples to get you started:

 
// Find records where column"sum" is greater than 10 and column"name"
// is either"Nick" or"Tony"
connection.find({
  where: {
    sum: { $gt: 10 },
    name: { $in: ['Nick', 'Tony'] }
  }
});

// Find a case insensitive and partial match to the"Email" column. For e.g. it will match with bobsmith@email.com or Bobsmith@email.com or smith@email.com
connection.find({
  where: {
    Email: { $iLike: 'BobSmith@email.com' }
  }
});

// Find records where column"email" matches the domain"example.org"
connection.find({
  where: {
    email: { $regex: /example\.org$/i }
  }
});

// Nested queries using the $or operator: find records where either"name" is"Nick"
// or"address" is"UK" and"name" is"Tony"
connection.find({
  where: {
    $or: [
      { name: 'Nick' },
      { address: 'UK', name: 'Tony' }
    ]
  }
});

// Find records where the column"country" is not"Germany" or"France"
// and"createdAt" is on or after a specific date
connection.find({
  where: {
    country: { $nin: ['Germany', 'France'] },
    createdAt: { $gte: '2018-03-20' }
  }
});

// Use Fliplet's custom $filters operator
// The"==" and"contains" conditions are optimized to perform better with Fliplet's database
connection.find({
  where: {
    // Find entries that match ALL of the following conditions
    $filters: [
      // Find entries with a case insensitive match on the column
      {
        column: 'Email',
        condition: '==',
        value: 'user@email.com'
      },
      // Find entries where the column does not match the value
      {
        column: 'Email',
        condition: '!=',
        value: 'user@email.com'
      },
      // Find entries where the column is greater than the value
      {
        column: 'Size',
        condition: '>',
        value: 10
      },
      // Find entries where the column is greater than or equal to the value
      {
        column: 'Size',
        condition: '>=',
        value: 10
      },
      // Find entries where the column is less than the value
      {
        column: 'Size',
        condition: '<',
        value: 10
      },
      // Find entries where the column is less than or equal to the value
      {
        column: 'Size',
        condition: '<=',
        value: 10
      },
      // Find entries with a case insensitive partial match on the column
      {
        column: 'Email',
        condition: 'contains',
        value: '@email.com'
      },
      // Find entries where the column is empty based on _.isEmpty()
      {
        column: 'Tags',
        condition: 'empty'
      },
      // Find entries where the column is not empty based on _.isEmpty()
      {
        column: 'Tags',
        condition: 'notempty'
      },
      // Find entries where the column is in between 2 numeric values (inclusive)
      {
        column: 'Size',
        condition: 'between',
        value: {
          from: 10,
          to: 20
        }
      },
      // Find entries where the column is one of the values
      {
        column: 'Category',
        condition: 'oneof',
        // value can also be a CSV string
        value: ['News', 'Tutorial']
      },
      // Find entries where the column matches a date comparison
      {
        column: 'Birthday',
        // Use dateis, datebefore or dateafter to match
        // dates before and after the comparison value
        condition: 'dateis',
        value: '1978-04-30'
        // Optionally provide a unit of comparison:
        //  - year
        //  - quarter
        //  - month
        //  - week
        //  - day
        //  - hour
        //  - minute
        //  - second
        // unit: 'month'
      },
      // Find entries where the column is before the a certain time of the day
      {
        column: 'Start time',
        condition: 'datebefore',
        value: '17:30'
      },
      // Find entries where the column is after a timestamp
      {
        column: 'Birthday',
        condition: 'dateafter',
        // Provide a full timestamp for comparison in YYYY-MM-DD HH:mm format
        value: '2020-03-10 13:03'
      },
      // Find entries where the column is between 2 dates (inclusive)
      {
        column: 'Birthday',
        condition: 'datebetween',
        from: {
          value: '1978-01-01'
        },
        to: {
          value: '1978-12-31'
        }
      }
    ]
  }
});
 

#### Filter the columns returned when finding records

Use the "attributes" array to optionally define a list of the columns that should be returned for the records.

 
// use"find" with"attributes" to filter the columns returned
connection.find({ attributes: ['Foo', 'Bar'] }).then(function (records) {
  // records is an array
});
 

You can also use this by passing an empty array as an efficient method to count the number of entries without requesting much data from the server:

 
connection.find({ attributes: [] }).then(function (records) {
  // use records.length as the number of records
});
 

#### Fetch records with pagination

You can use the "limit" and "offset" parameters to filter down the returned entries to a specific chunk (page) of the Data Source.

 
// use limit and offset for pagination
connection.find({
  limit: 50,
  offset: 10
});
 

Full example:

 
Fliplet.DataSources.connect(123).then(function (connection) {
  return connection.find({ limit: 1000 }).then(function (results) {

  });
});
 

Moreover, the "includePagination" parameter enables the response to return the count of total entries in the Data Source:

 
connection.find({
  limit: 50,
  offset: 10,
  includePagination: true
}).then(function (response) {
  // response.entries []
  // response.pagination = { total, limit, offset }
});
 

Note that when using the above parameter, the returned object from the "find()" method changes from an array of records to an object with the following structure:


{
 "entries": [],
 "dataSourceId": 123456,
 "count": 50,
 "pagination": {
   "total": 1000,
   "limit": 50,
   "offset": 10
  }
}

#### Run aggregation queries

You can use the built-in [Mingo](https://github.com/kofrasa/mingo) library to run complex aggregation queries or projections on top of Data Sources. Mingo operations can be provided to the "find" method via the "aggregate" attribute:

 
// This example groups records by values found on a sample column"myColumnName"
// and counts the matches for each value
connection.find({
  aggregate: [
    {
      $project: {
        numericData: { $convertToNumber: $data.myColumnName }
      }
    },
    {
      $group: {
        _id: '$numericData',
        avg: { $avg: $numericData }
      }
    }
  ]
});
 
The version of Mingo we have used does not automatically typecast strings to numbers. Therefore, we have added our own custom operator ($convertToNumber) to type cast to a number before performing aggregation. To use this custom operator, please refer to above snippet.


### Sort / order the results

Use the "order" array of arrays to specify the sorting order for the returned entries.

You can order by:
- Fliplet columns: "id", "order", "createdAt", "deletedAt", "updatedAt"
- Entry columns, using the "data." prefix (e.g. "data.Email")

The order direction is either "ASC" for ascending ordering or "DESC" for descending ordering.

The "order" array accepts a list of arrays, where each includes the column and sorting order:

 
// Sort records by their created time (first records are newer)
connection.find({
  where: { Office: 'London' },
  order: [
    ['createdAt', 'DESC']
  ]
}).then(function (records) {
  // ...
});

// Sort records alphabetically by their last name first and then first name
connection.find({
  where: { Office: 'London' },
  order: [
    ['data.LastName', 'ASC'],
    ['data.FirstName', 'ASC']
  ]
}).then(function (records) {
  // ...
});
 

### Find a specific record

The "findOne" method allows you to look for up to one record, limiting the amount of entries returned if you're only looking for one specific entry.

 
connection.findOne({
  where: { name: 'John' }
}).then(function (record) {
  // record is either the found entry"object" or"undefined"
});
 

### Find a record by its ID

This is a code snippet for finding a record in a specific Data Source by its ID.

The "findById()" method accepts a single parameter, which is the ID of the entry to search for in the Data Source. Once the entry has been found, it will be returned as a record object in the response, and the code inside the promise callback function will be executed.

 
connection.findById(1).then(function (record) {
  // records is the found object
});
 

### Commit changes at once to a data source

Use "connection.commit(Array)" to commit more than one change at once to a data source. You can use this to insert, update and delete entries at the same time with a single request. This makes it very efficient in terms of both minimizing the network requests and computation required from both sides.

List of input parameters:
  - "entries": (required array): the list of entries to insert or update ("{ data }" for insert and "{ id, data }" for updates).
  - "append": (optional boolean, defaults to false): set to "true" to keep existing remote entries not sent in the updates to be made. When this is set to "false" you will essentially be replacing the whole data source with just the data you are sending.
  - "delete": (optional array): the list of entry IDs to remove (when used in combination with "append: true").
  - "extend" (optional boolean, defaults to false): set to "true" to enable merging the local columns you are sending with any existing columns for the affected data source entries.
  - "runHooks" (optional array) the list of hooks ("insert" or "update") to run on the data source during the operation.
  - "returnEntries" (optional boolean, defaults to true): set to "false" to stop the API from returning all the entries in the data source

The following sample request applies the following changes to the data source:
  - inserts a new entry
  - updates the entry with ID 123 merging its data with the new added column(s)
  - deletes the entry with ID 456

 
connection.commit({
  entries: [
    // Insert a new entry
    { data: { foo: 'bar' } },

    // Update the entry with ID 123
    { id: 123, data: { foo: 'barbaz' } }
  ],

  // Delete the entry with ID 456
  delete: [456],

  // Ensure existing entries are unaffected
  append: true,

  // Keep remote columns not sent with
  // the updates of entry ID 123
  extend: true,

  // Do not return the whole data source after updating the data.
  // Keep this as"false" to speed up the response.
  returnEntries: false
});
 

---

### Insert a single record into the data source

To insert a record into a data source, use the "connection.insert" method by passing the data to be inserted as a **JSON** object or a **FormData** object.

 
// Using a JSON object
connection.insert({
  id: 3,
  name: 'Bill'
});

// Using a FormData object
connection.insert(FormData);
 

**Note**: the "dataSourceId" and "dataSourceEntryId" are **reserved keys** and should not be used in the input JSON.

The second parameter of the "connection.insert" function accepts various options as described below:

  - [folderId](#options-folderid) (Number)
  - [ack](#options-ack) (Boolean)

#### **Options: folderId**

When "FormData" is used as first parameter, your record gets uploaded using a multipart request. If your FormData contains files, you can specify the **MediaFolder** where files should be stored to using the "folderId" parameter:

 
connection.insert(FormData, {
  folderId: 123
});
 

#### **Options: ack**

If you want to make sure the local (offline) database on the device also gets updated as soon as the server receives your record you can use the "ack" (which abbreviates the word **acknowledge**) parameter:

 
connection.insert({ foo: 'bar' }, {
  // this ensure the local database gets updated straight away, without
  // waiting for silent updates (which can take up to 30 seconds to be received).
  ack: true
});
 

---

### Update a record (entry)

Updating a data source entry is done via the "connection.insert" method by providing its ID and the update to be applied.

 
connection.update(123, {
  name: 'Bill'
});
 

You can also pass a "FormData" object to upload files using a multipart request. When uploading files, you can also specify the MediaFolder where files should be stored to:

 
connection.update(123, FormData, {
  mediaFolderId: 456
});
 


### Remove a record by its ID

Use the "removeById" method to remove a entry from a data source given its ID.

 
connection.removeById(1).then(function onRemove() {});
 
### Remove entries matching a query

Set "type" to "delete" and specify a where clause. This will query the data source and delete any matching entries.

 
connection.query({
  type: 'delete',
  where: { Email: 'test@fliplet.com' }
});
 

### Get unique values for a column

Use the "getIndex" method to get unique values for a given column of the Data Source:

 
connection.getIndex('name').then(function onSuccess(values) {
  // array of unique values
});
 

### Get unique values for multiple columns at once

Use the "getIndexes" method to get unique values for a given array of columns of the Data Source:

 
connection.getIndexes(['name','email']).then(function onSuccess(values) {
  // an object having key representing each index and the value being the array of values
  // e.g. { name: ['a', 'b'], email: ['c', 'd'] }
});
 


### Format of data returned from JS API

If referencing data from a data source, the entry will be found under the"data" object as shown below. 

{
"id": 404811749,
"data": {
"Email":"hrenfree1t@hugedomains.com",
"Title":"Manager",
"Prefix":"Mrs",
"Last Name":"Renfree",
"Department":"Operations",
"First Name":"Hayley",
"Middle Name":"Issy"
},
"order": 0,
"createdAt":"2025-02-19T17:13:51.507Z",
"updatedAt":"2025-02-19T17:13:51.507Z",
"deletedAt": null,
"dataSourceId": 1392773
}


If you are asked to build a feature that requires navigating the user to another screen use the navigate JS API to do this: 

Fliplet.Navigate.screen('Menu') where it accepts the screen name as a parameter. 

If you want to show a message to the end user do not use alerts but use our toast message library; The JS API is Fliplet.UI.Toast(message) where message is the text you want to show the user. 

If you want to get the logged-in user's details, you can use the following endpoint: 
Fliplet.User.getCachedSession().then(function (session) {
  var user = _.get(session, 'entries.dataSource.data');

  if (!user) {
    return; // user is not logged in
  }

  // contains all columns found on the connected dataSource entry for user.Email
  console.log(user);
});

If you are asked to join data across multiple data sources then use the below JS API:

Both DataSources JS APIs and REST APIs allow you to fetch data from more than one dataSource using a featured called"join", heavily inspired by traditional joins made in SQL databases.

Joins are defined by a unique name and their configuration options; any number of joins can be defined when fetching data from one data source:

Fliplet.DataSources.connect(123).then(function (connection) {
  // 1. Extract articles from dataSource 123
  return connection.find({
    join: {
      // ... with their comments
      Comments: { options },

      // ... and users who posted them
      Users: { options }
    }
  })
}).then(console.log)
Before we dive into complete examples, let's start with the three types of joins we support.

Types of joins
Left join (default)
Use this when you want to fetch additional data for your dataSource. Examples include things like getting the list of comments and likes for a list of articles.

Left joins must be defined by specifying:

the target dataSource ID with the dataSourceId parameter (or dataSourceName if you want to connect by using the data source name)
what data should be used to reference entries from the initial dataSource to the joined dataSource, using the on parameter, where the key is the column name from the source table and the value is the column name of the target (joined) table.
Consider an example where two dataSources are created as follows:

Articles
ID	Title
1	A great blog post
2	Something worth reading
Comments
ArticleID	Comment text	Likes
1	Thanks! This was worth reading.	5
1	Loved it, would read it again.	2
We can simply reference the entries between the two dataSources as follows:

connection.find({
  join: {
    Comments: {
      dataSourceId: 123,
      on: {
        'data.ID': 'data.ArticleID'
      }
    }
  }
})
Inner join
Use this when the entries of your dataSource should only be returned when there are matching entries from the join operations. Tweaking the above example, you might want to use this when you want to extract the articles and their comments and make sure only articles with at least one comment are returned.

Inner joins are defined like left joins but with the required attribute set to true:

connection.find({
  join: {
    Comments: {
      dataSourceId: 123,
      on: {
        'data.ID': 'data.ArticleID'
      },
      required: true
    }
  }
})
Outer join
Use this when you want to merge entries from the joined dataSource(s) to the ones being extracted from your dataSource. The result will simply be a concatenation of both arrays.

Outer joins are similar to other joins in regards to how they are defined, but don't need the on parameter defined since they don't need to reference entries between the two dataSources:

connection.find({
  join: {
    MyOtherArticles: {
      dataSourceId: 789
    }
  }
})
Types of data returned in joins
Joins can return data in several different ways:

An Array of the matching entries. This is the default behaviour for joins.
A Boolean to indicate whether at least one entry was matched.
A Count of the matched entries.
A Sum taken by counting a number in a defined column from the matching entries.
Array (join)
This is the default return behaviour for joins, hence no parameters are required.

Example input:

connection.find({
  join: {
    Comments: {
      dataSourceId: 123,
      on: {
        'data.ID': 'data.ArticleID'
      }
    }
  }
})
Example of the returned data:

[
  {
    id: 1,
    dataSourceId: 456,
    data: { Title: 'A great blog post' },
    join: {
      Comments: [
        {
          id: 3,
          dataSourceId: 123,
          data: { ArticleID: 1, 'Comment text': 'Thanks! This was worth reading.', Likes: 5 }
        },
        {
          id: 4,
          dataSourceId: 123,
          data: { ArticleID: 1, 'Comment text': 'Loved it, would read it again.', Likes: 2 }
        }
      ]
    }
  }
]
Boolean (join)
When the has parameter is set to true, a boolean will be returned to indicate whether at least one entry was matched from the joined entries.

Example input:

connection.find({
  join: {
    HasComments: {
      dataSourceId: 123,
      on: {
        'data.ID': 'data.ArticleID'
      },
      has: true
    }
  }
})
Example of the returned data:

[
  {
    id: 1,
    dataSourceId: 456,
    data: { Title: 'A great blog post' },
    join: {
      HasComments: true
    }
  },
  {
    id: 2,
    dataSourceId: 456,
    data: { Title: 'Something worth reading' },
    join: {
      HasComments: false
    }
  }
]
Count (join)
When the count parameter is set to true, a count of the matching entries will be returned.

Example input:

connection.find({
  join: {
    NumberOfComments: {
      dataSourceId: 123,
      on: {
        'data.ID': 'data.ArticleID'
      },
      count: true
    }
  }
})
Example of the returned data:

[
  {
    id: 1,
    dataSourceId: 456,
    data: { Title: 'A great blog post' },
    join: {
      NumberOfComments: 2
    }
  },
  {
    id: 2,
    dataSourceId: 456,
    data: { Title: 'Something worth reading' },
    join: {
      NumberOfComments: 0
    }
  }
]
Sum (join)
When the sum parameter is set to the name of a column, a sum taken by counting the number of all matching entries for such column will be returned.

Example input:

connection.find({
  join: {
    LikesForComments: {
      dataSourceId: 123,
      on: {
        'data.ID': 'data.ArticleID'
      },
      sum: 'Likes'
    }
  }
})
Example of the returned data:

[
  {
    id: 1,
    dataSourceId: 456,
    data: { Title: 'A great blog post' },
    join: {
      LikesForComments: 7
    }
  },
  {
    id: 2,
    dataSourceId: 456,
    data: { Title: 'Something worth reading' },
    join: {
      LikesForComments: 0
    }
  }
]
Filtering data
Use the where parameter to define a filtering query for the data to be selected on a particular join. This support the same exact syntax as connection.find({ where }):

connection.find({
  join: {
    LikesForPopularComments: {
      dataSourceId: 123,
      on: {
        'data.ID': 'data.ArticleID'
      },
      where: {
        // only fetch a comment when it has more than 10 likes
        Likes: { $gt: 10 }
      }
    }
  }
})
Only fetch a list of attributes
Use the attributes parameter to define which fields should only be returned from the data in the joined entries:

connection.find({
  join: {
    LikesForComments: {
      dataSourceId: 123,
      on: {
        'data.ID': 'data.ArticleID'
      },
      // only fetch the comment text
      attributes: ['Comment text']
    }
  }
})
Limit the number of returned entries
Use the limit parameter to define how many entries should be returned at most for your join:

connection.find({
  join: {
    LikesForComments: {
      dataSourceId: 123,
      on: {
        'data.ID': 'data.ArticleID'
      },
      // only fetch up to 5 comments at most
      limit: 5
    }
  }
})
Order the entries returned
Use the order parameter to define the order at which entries are returned for your join.

Note: this parameter can be used for attributes such as"id" and"createdAt". If you need to order by actual data in your entry, use the"data." prefix (such as data.Title).

connection.find({
  join: {
    MostRecentComments: {
      dataSourceId: 123,
      on: {
        'data.ID': 'data.ArticleID'
      },
      // only fetch the 5 most recent comments, combining order and limit
      order: ['createdAt', 'DESC'],
      limit: 5
    }
  }
})
Connecting to a data source by name
Use the dataSourceName parameter to connect to a data source by its name instead of ID:

connection.find({
  join: {
    LikesForComments: {
      dataSourceName: 'User comments',
      on: {
        'data.ID': 'data.ArticleID'
      },
      // only fetch the comment text
      attributes: ['Comment text']
    }
  }
})

## Send an email

Use our APIs to send an email to one or more recipients. Note that this feature is rate limited and improper use will result in your account being flagged for suspension.

Available options:

  - "to": array of recipients for "to", "cc" or "bcc"
  - "subject": subject of the email
  - "from_name": the sender's name
  - "html": HTML string for the email body
  - "headers": "key:value" object with headers to add to the email (most headers are allowed). We recommend using "X-*" prefixes to any custom header, e.g. "X-My-Custom-Header: "value"
  - "attachments": array of attachments with "type" (the MIME type), "content" (String or Buffer), "name" (the filename including extension) and optional "encoding" (base64, hex, binary, etc)
  - "required": Set to "true" to queue the request if the device is offline. When the device comes online, the queued requests will be sent. Default: "false"

var options = {
  to: [
    { email: "john@example.org", name: "John", type: "to" },
    { email: "jane@example.org", name: "Jane", type: "cc" }
  ],
  html: "<p>Some HTML content</p>",
  subject: "My subject",
  from_name: "Example Name",
  headers: {
    "Reply-To": "message.reply@example.com"
  },
  attachments: [
    {
      type: "text/plain",
      name: "myfile.txt",
      content: "Hello World"
    },
    {
      type: "image/png",
      name: "test.png",
      encoding: 'base64',
      // You can use our JS API to encode your content string to base64
      content: Fliplet.Encode.base64("hello world")
    }
  ]
};

// Returns a promise
Fliplet.Communicate.sendEmail(options);
`;

  return Fliplet.AI.createCompletion({
    model: "o3-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    reasoning_effort: "low",
  }).then(function (result) {
    // Parse the response
    const response = result.choices[0].message.content;

    // Initialize variables
    let html = "";
    let css = "";
    let javascript = "";

    // Extract HTML
    const htmlMatch = response.match(/### HTML\n([\s\S]*?)(?=### CSS|$)/);
    if (htmlMatch) {
      html = htmlMatch[1].trim();
    }

    // Extract CSS
    const cssMatch = response.match(/### CSS\n([\s\S]*?)(?=### JavaScript|$)/);
    if (cssMatch) {
      css = cssMatch[1].trim();
    }

    // Extract JavaScript
    const jsMatch = response.match(/### JavaScript\n([\s\S]*?)(?=$)/);
    if (jsMatch) {
      javascript = jsMatch[1].trim();
    }

    return {
      html,
      css,
      javascript,
    };
  });
}

function saveGeneratedCode(parsedContent) {
  Fliplet.Helper.field("layoutHTML").set(parsedContent.html);
  Fliplet.Helper.field("css").set(parsedContent.css);
  Fliplet.Helper.field("javascript").set(parsedContent.javascript);
  Fliplet.Helper.field("regenerateCode").set(true);

  var data = Fliplet.Widget.getData();
  data.fields.dataSourceId = selectedDataSourceId;
  data.fields.dataSourceName = selectedDataSourceName;
  data.fields.prompt = Fliplet.Helper.field("prompt").get();
  data.fields.layoutHTML = parsedContent.html;
  data.fields.css = parsedContent.css;
  data.fields.javascript = parsedContent.javascript;
  data.fields.regenerateCode = true;

  return Fliplet.Widget.save(data.fields).then(function () {
    Fliplet.Studio.emit("reload-widget-instance", widgetId);
    toggleLoader(false);
    setTimeout(function () {
      Fliplet.Helper.field("regenerateCode").set(false);
      data.fields.regenerateCode = false;
      Fliplet.Widget.save(data.fields);
    }, 1000);
  });
}
