// Windows competition launcher. Build after generating campus-flora-offline.html.
package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

//go:embed campus-flora-offline.html
var page []byte

const service = "https://cau-campus-flora-notebook.bubblybox131.chatgpt.site"
const appVersion = "campus-flora-local/0.4.0"

func problem(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func forward(w http.ResponseWriter, r *http.Request, client *http.Client, contentType string, limit int64) {
	if r.Method != http.MethodPost {
		problem(w, 405, "请使用 POST 请求。")
		return
	}
	if r.Header.Get("Origin") != "http://"+r.Host {
		problem(w, 403, "请从本机植迹页面发起请求。")
		return
	}
	media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != contentType {
		problem(w, 415, "文件或请求格式不正确。")
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, limit))
	if err != nil {
		problem(w, 413, "提交内容过大或读取失败。")
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, service+r.URL.Path, bytes.NewReader(body))
	if err != nil {
		problem(w, 500, "无法准备请求。")
		return
	}
	req.Header.Set("Content-Type", contentType)
	res, err := client.Do(req)
	if err != nil {
		problem(w, 503, "无法连接植迹在线服务，请检查网络后重试。")
		return
	}
	defer res.Body.Close()
	data, err := io.ReadAll(io.LimitReader(res.Body, (128<<10)+1))
	if err != nil || len(data) > 128<<10 || !json.Valid(data) {
		problem(w, 502, "在线服务返回异常，请稍后重试。")
		return
	}
	if res.StatusCode == 401 && r.URL.Path == "/api/identify" {
		problem(w, 503, "植迹识别服务暂未配置，请联系项目维护者。")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(res.StatusCode)
	_, _ = w.Write(data)
}

func localApp(host string) http.HandlerFunc {
	html := bytes.Replace(page, []byte("<head>"), []byte("<head><meta name=\"flora-local-edition\" content=\"1\">"), 1)
	client := &http.Client{Timeout: 90 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if r.Host != host {
			problem(w, 403, "主机地址无效。")
			return
		}
		switch r.URL.Path {
		case "/", "/index.html", "/__flora/version":
			if r.Method != http.MethodGet && r.Method != http.MethodHead {
				problem(w, 405, "请求方式无效。")
				return
			}
			if r.URL.Path == "/__flora/version" {
				w.Header().Set("Content-Type", "text/plain")
				fmt.Fprint(w, appVersion)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("X-Frame-Options", "DENY")
			_, _ = w.Write(html)
		case "/api/identify":
			forward(w, r, client, "image/jpeg", 4000000)
		case "/api/model":
			forward(w, r, client, "application/json", 4096)
		default:
			http.NotFound(w, r)
		}
	}
}

func openPage(url string) {
	if err := exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url).Start(); err != nil {
		fmt.Println("请在浏览器打开", url)
	}
}

func alreadyRunning(url string) bool {
	client := http.Client{Timeout: time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	res, err := client.Get(url + "__flora/version")
	if err != nil {
		return false
	}
	defer res.Body.Close()
	data, err := io.ReadAll(io.LimitReader(res.Body, 128))
	return err == nil && res.StatusCode == 200 && strings.TrimSpace(string(data)) == appVersion
}

func main() {
	port := flag.Int("port", 28731, "local browser port")
	noBrowser := flag.Bool("no-browser", false, "do not open the default browser")
	flag.Parse()
	host := fmt.Sprintf("127.0.0.1:%d", *port)
	url := "http://" + host + "/"
	listener, err := net.Listen("tcp4", host)
	if err != nil {
		if alreadyRunning(url) {
			if !*noBrowser {
				openPage(url)
			}
			return
		}
		fmt.Fprintln(os.Stderr, "植迹无法启动，请关闭占用本地端口的程序后重试。", err)
		os.Exit(1)
	}
	srv := http.Server{Handler: localApp(host), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 35 * time.Second, WriteTimeout: 100 * time.Second, IdleTimeout: 30 * time.Second}
	fmt.Println("植迹 · 校园植物观察手记", url)
	fmt.Println("使用期间请保留此窗口；关闭窗口即可退出本地服务。")
	if !*noBrowser {
		openPage(url)
	}
	if err := srv.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
