" .vimrc - minimal sane defaults

set nocompatible
syntax on
filetype plugin indent on

" 表示
set number              " 行番号
set laststatus=2        " ステータスライン常時表示
set scrolloff=3         " カーソル上下に余白
set wildmenu            " コマンドライン補完をメニュー表示
set showmatch           " 対応する括弧をハイライト
set matchtime=1

" 検索
set ignorecase          " 大文字小文字を無視
set smartcase           " 大文字を含む場合は区別する
set incsearch           " インクリメンタル検索
set hlsearch            " 検索結果をハイライト
nnoremap <Esc><Esc> :nohlsearch<CR>

" インデント
set expandtab           " タブをスペースに
set tabstop=4
set shiftwidth=4
set smartindent

" 操作
set mouse=a             " マウス有効
set backspace=indent,eol,start
set whichwrap=b,s,h,l,<,>,[,]

if has('clipboard')
  set clipboard=unnamedplus
endif
