$(window).on('load', function () {
    const converter = new showdown.Converter()
    let apiconfig = { raw: null, parsed: { endpoints: [] } };
    const apiConfigUrl = $('meta[name=apiconfig]').prop('content');
    loadApiConfig(apiConfigUrl);
    function loadApiConfig(url) {
        if (url) {
            $.get(url, function (data) {
                apiconfig.raw = data;
                parseApiDocs(apiconfig.raw);
            }).fail(function (error) {
                alert("Cant Load ApiConfig Url!, Check Console Log for more Information")
                console.log(error)
            });
        } else {
            alert("Please Define Api Config Url on Meta Header Tag")
        }
    }
    function parseApiDocs(cfg) {
        document.title = `UGApiDocs - ${cfg.info.title}`
        $("#api_desc").html(converter.makeHtml(cfg.info.description))
        $("#api_title").html(cfg.info.title)
        $("#api_version").html(cfg.info.version)
        $("#api_baseurl").val(`${cfg.host}${cfg.basePath}`)
        $("#api_baseurl_cp_btn").on('click', function () {
            $("#api_baseurl").select();
            document.execCommand("copy");
            $("#api_baseurl").tooltip('show');
        });
        for (const schema of cfg.schemes) {
            $("#api_schema").append(new Option(schema.toUpperCase(), schema)).change();
        }
        let endpoint_id = 0;
        for (const endpoint in cfg.paths) {
            let endpoint_methods = cfg.paths[endpoint];
            for (const method in endpoint_methods) {
                apiconfig.parsed.endpoints.push(
                    {
                        "host": `${cfg.host}${cfg.basePath}`,
                        "method": method,
                        "endpoint": endpoint,
                        "parameters": endpoint_methods[method].parameters
                    }
                )
                endpoint_id += 1;
                $("#api_endpoints").append(`
                <div class="card api-summary ${method}">
                    <div class="card-body">
                        <span class="api-summary-method">${method.toUpperCase()}</span>
                        <span class="api-summary-path">${endpoint}</span>
                        <span class="api-summary-btn collapsed" data-toggle="collapse" data-target="#ep_path${endpoint_id}"><i class="fa" aria-hidden="true"></i></span>
                        <div id="ep_path${endpoint_id}" class="collapse">
                            <hr>
                            <div class="mx-2">
                                <p>${endpoint_methods[method].summary}</p>
                                ${converter.makeHtml(endpoint_methods[method].description)}
                            </div>
                            <table class="table">
                            <thead>
                              <tr>
                                <th>Parameters</th>
                                <th class="desc_endpoint">Description
                                <button class="btn btn-primary btn-sm pull-right tryapi" attr-api-index="${(endpoint_id - 1)}">Try API <i class="fa fa-chevron-right"></i></button>
                                </th>
                              </tr>
                            </thead>
                            <tbody id="ep_vars${endpoint_id}"></tbody>
                          </table>
                        </div>
                    </div>
                </div>
                `);
                for (const param of endpoint_methods[method].parameters) {

                    $(`#ep_vars${endpoint_id}`).append(`<tr>
                        <td>
                            ${param.required ? `<b>${param.name}</b>` : param.name} ${param.required ? '<code>*Required</code>' : ''}<br>
                            <pre class="mb-0">${param.type ? param.type : 'Object'}</pre>
                            <small class="text-muted">(<i>${param.in}</i>)</small>
                        </td>
                        <td>
                            ${converter.makeHtml(param.description)}
                            ${param.type ? (param.type == 'array' && param.items.enum ? `<br>[${param.items.enum.join(",")}]` : '') : ''}
                        </td>
                    </tr>`)
                }
            }
        }
    }
    $("#api_endpoints").on('click', '.tryapi', function () {
        let endpoint_index = $(this).attr("attr-api-index");
        $("#myModal").modal("show")
        $(".ajaxloader").hide();
        $('#nav_custom_param').trigger('click')
        let api_schema = $("#api_schema").val();
        let endpoint_data = apiconfig.parsed.endpoints[endpoint_index];
        $('#url_param_modal').val(`${api_schema}://${endpoint_data.host}${endpoint_data.endpoint}`)
        $("#param_modal_tb").html(`<input type='hidden' name='_index_api' value='${endpoint_index}'>`)
        $("#try-api-method").attr("class", `btn btn-success try-method ${endpoint_data.method} px-2`)
        for (const param of endpoint_data.parameters) {
            $("#param_modal_tb").append(`<tr>
                <td>
                    ${param.required ? `<b>${param.name}</b>` : param.name} ${param.required ? '<code>*Required</code>' : ''}<br>
                    <pre class="mb-0">${param.type ? param.type : 'Object'}</pre>
                    <small class="text-muted">(<i>${param.in}</i>)</small>
                </td>
                <td>
                    ${converter.makeHtml(param.description)}
                    ${param.type ?
                    (param.type == 'file' ?
                        `<input type="file" class="form-control form-control-sm" name='${param.name}'${param.required ? 'required' : ''}>`
                        : (param.type == 'array' && param.items.enum ?
                            `<select class="form-control form-control-sm" name='${param.name}' ${param.required ? 'required' : ''}><option>${param.items.enum.join("</option><option>")}</option></select>`
                            : `<input type="text" class="form-control form-control-sm" name='${param.name}' placeholder="${param.name}" ${param.required ? 'required' : ''}>`)
                    ) : `<textarea placeholder="${param.name}" name='${param.name}' class="form-control form-control-sm" ${param.required ? 'required' : ''}></textarea>`
                }
                </td>
            </tr>`)
        }
    });
    $("#param_modal").on('submit', '.modal_param_form', function (e) {
        let api_schema = $("#api_schema").val();
        let endpoint_index = 0;
        let endpointform = new FormData(this)
        for (const pair of endpointform) {
            if (pair[0] == "_index_api") {
                endpoint_index = pair[1]
                break;
            }
        }
        let endpoint_data = apiconfig.parsed.endpoints[endpoint_index];
        let apihost = endpoint_data.host
        let formdata = new FormData();
        let inquery = {};
        let inpath = [];
        for (const pair of endpointform) {
            if (pair[0] == "_index_api") continue;
            let skip = false;
            for (const param of endpoint_data.parameters) {
                if (param.name == pair[0]) {
                    if (param.in == 'query') {
                        inquery[param.name] = pair[1];
                        skip = true;
                        continue;
                    } else if (param.in == 'path') {
                        inpath.push({ name: param.name, value: pair[1] });
                        skip = true;
                        continue;
                    }
                }
            }
            if (skip) continue;
            formdata.append(pair[0], pair[1]);
        }
        let newurl = endpoint_data.endpoint;
        for (const path of inpath) {
            newurl = newurl.replace(`{${path.name}}`, `${path.value}`)
        }
        if (inquery.length) newurl += `?${new URLSearchParams(inquery).toString()}`
        $(".ajaxloader").show();
        $("#param_modal_head_res").html(``);
        $.ajax({
            url: `${api_schema}://${apihost}${newurl}`,
            data: formdata,
            processData: false,
            type: endpoint_data.method,
            cache: false,
        }).done(function (data, status, jqXHR) {
            try{
                $("#text_resp_modal").val(JSON.stringify(data, null, 2));
            } catch(err){
                $("#text_resp_modal").val(data);
            }
            $("#param_modal_head_res").append(`<tr><td>status</td><td>${jqXHR.status} ${jqXHR.statusText.trim()}</td></tr>`)
            for (const headraw of jqXHR.getAllResponseHeaders().split("\n")) {
                if (!headraw.trim()) continue;
                let head = headraw.split(": ");
                $("#param_modal_head_res").append(`<tr><td>${head[0].trim()}</td><td>${head[1].trim()}</td></tr>`)
            }
        }).fail(function (jqXHR, status) {
            try{
                $("#text_resp_modal").val(((jqXHR.status > 0) ? JSON.stringify(JSON.parse(jqXHR.responseText), null, 2) : status));
            } catch(err){
                $("#text_resp_modal").val(((jqXHR.status > 0) ? jqXHR.responseText : status));
            }
            $("#param_modal_head_res").append(`<tr><td>status</td><td>${jqXHR.status} ${jqXHR.statusText.trim()}</td></tr>`)
            for (const headraw of jqXHR.getAllResponseHeaders().split("\n")) {
                if (!headraw.trim()) continue;
                let head = headraw.split(": ");
                $("#param_modal_head_res").append(`<tr><td>${head[0].trim()}</td><td>${head[1].trim()}</td></tr>`)
            }
        }).always(function () {
            $(".ajaxloader").hide();
        });
        $('#nav_custom_respon').trigger('click')
        e.preventDefault();
    });
});