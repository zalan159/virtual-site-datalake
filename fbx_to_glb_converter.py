#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import subprocess
import argparse
from pathlib import Path

def convert_fbx_to_glb(input_folder):
    # 转换路径到绝对路径
    input_folder = os.path.abspath(input_folder)
    
    # 创建输出文件夹
    output_folder = os.path.join(input_folder, "GLB")
    os.makedirs(output_folder, exist_ok=True)
    
    # ImportExport程序路径
    import_export_path = "/Users/zhouzal/Downloads/HOOPS_Exchange_2025.3.0/samples/exchange/exchangesource/ImportExport/ImportExport"
    
    # 获取所有fbx文件
    fbx_files = [f for f in os.listdir(input_folder) if f.lower().endswith('.obj')]
    
    if not fbx_files:
        print(f"在 {input_folder} 中没有找到FBX文件")
        return
    
    # 切换到ImportExport所在目录
    original_dir = os.getcwd()
    import_export_dir = os.path.dirname(import_export_path)
    os.chdir(import_export_dir)
    
    # 批量转换
    for fbx_file in fbx_files:
        input_path = os.path.join(input_folder, fbx_file)
        output_filename = os.path.splitext(fbx_file)[0] + ".glb"
        output_path = os.path.join(output_folder, output_filename)
        
        print(f"正在转换: {fbx_file} -> {output_filename}")
        
        try:
            # 运行ImportExport命令
            cmd = [
                "./ImportExport",
                input_path,
                output_path
            ]
            
            # 执行命令
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"转换成功: {output_filename}")
            else:
                print(f"转换失败: {fbx_file}")
                print(f"错误信息: {result.stderr}")
                
        except Exception as e:
            print(f"处理 {fbx_file} 时出错: {str(e)}")
    
    # 恢复原始工作目录
    os.chdir(original_dir)
    print(f"转换完成! 输出文件保存在: {output_folder}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="批量将FBX文件转换为GLB格式")
    parser.add_argument("input_folder", help="包含FBX文件的输入文件夹路径")
    
    args = parser.parse_args()
    convert_fbx_to_glb(args.input_folder) 