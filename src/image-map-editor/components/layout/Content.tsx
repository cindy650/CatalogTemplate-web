import { Layout, Spin } from 'antd';
import React, { Component } from 'react';

interface IProps {
	title?: React.ReactNode;
	leftSider?: React.ReactNode;
	content?: React.ReactNode;
	rightSider?: React.ReactNode;
	className?: string;
	loading?: boolean;
	children?: React.ReactNode;
}

class Content extends Component<IProps> {
	static defaultProps = {
		className: 'rde-content-layout-main',
		loading: false,
	};

	render() {
		const { title, leftSider, content, rightSider, className, loading, children } = this.props;
		return (
			<Spin
				className="rde-content-spin"
				spinning={loading}
				style={{
					display: 'flex',
					width: '100%',
					height: '100%',
					minHeight: 0,
					maxHeight: '100%',
					overflow: 'hidden',
				}}
				styles={{
					container: {
						display: 'flex',
						width: '100%',
						height: '100%',
						minHeight: 0,
						maxHeight: '100%',
						flex: 1,
						flexDirection: 'column',
						overflow: 'hidden',
					},
				}}
			>
				<Layout className="rde-content-layout">
					{title}
					<Layout className={className}>
						{leftSider}
						{content || children}
						{rightSider}
					</Layout>
				</Layout>
			</Spin>
		);
	}
}

export default Content;
