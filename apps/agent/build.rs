fn main() {
    let protoc = protoc_bin_vendored::protoc_bin_path().expect("vendored protoc is unavailable");
    std::env::set_var("PROTOC", protoc);

    let proto = "../../packages/protocol/proto/agent_control.proto";
    println!("cargo:rerun-if-changed={proto}");

    tonic_prost_build::configure()
        .build_server(false)
        .build_client(true)
        .compile_protos(&[proto], &["../../packages/protocol/proto"])
        .expect("failed to compile protobuf");
}
